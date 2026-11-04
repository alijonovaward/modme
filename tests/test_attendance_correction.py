from datetime import datetime, timedelta, timezone

from app.models.attendance import Attendance
from app.models.group_student import GroupStudent, GroupStudentStatus
from app.models.user import User
from tests.conftest import add_student_to_group, auth_headers, login, make_group, make_lesson, make_staff, make_student, make_subject


def _setup_lesson_with_attendance(client, superadmin_headers, admin_headers, *, teacher_phone, student_phones, lesson_price=50000, teacher_percentage=40):
    teacher = make_staff(
        client, superadmin_headers, role="teacher", phone=teacher_phone, teacher_percentage=teacher_percentage
    )
    subject = make_subject(client, admin_headers, "Correction-Subject")
    group = make_group(
        client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"], lesson_price=lesson_price
    )

    students = []
    for phone in student_phones:
        student = make_student(client, admin_headers, phone=phone)
        client.post(
            f"/api/v1/students/{student['id']}/deposit",
            headers=admin_headers,
            json={"amount": 500000},
        )
        add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])
        students.append(student)

    lesson = make_lesson(client, admin_headers, group_id=group["id"])
    teacher_headers = auth_headers(login(client, teacher["phone"], "pass123"))

    return teacher, group, lesson, students, teacher_headers


def _balance(db_session, user_id: int) -> float:
    db_session.expire_all()
    return db_session.get(User, user_id).balance


def test_unexcused_to_present_does_not_move_money(client, superadmin_headers, admin_headers, db_session):
    teacher, group, lesson, students, teacher_headers = _setup_lesson_with_attendance(
        client, superadmin_headers, admin_headers, teacher_phone="+998900500001", student_phones=["+998900500002"]
    )
    student = students[0]

    resp = client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "unexcused"}]},
    )
    assert resp.status_code == 201, resp.text

    student_balance_before = _balance(db_session, student["id"])
    teacher_balance_before = _balance(db_session, teacher["id"])

    resp = client.put(
        f"/api/v1/lessons/{lesson['id']}/attendance/{student['id']}",
        headers=teacher_headers,
        json={"status": "present", "grade": 5},
    )
    assert resp.status_code == 200, resp.text

    assert _balance(db_session, student["id"]) == student_balance_before
    assert _balance(db_session, teacher["id"]) == teacher_balance_before


def test_excused_to_present_charges_student_and_pays_teacher(client, superadmin_headers, admin_headers, db_session):
    teacher, group, lesson, students, teacher_headers = _setup_lesson_with_attendance(
        client, superadmin_headers, admin_headers, teacher_phone="+998900500003", student_phones=["+998900500004"]
    )
    student = students[0]

    resp = client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "excused"}]},
    )
    assert resp.status_code == 201, resp.text

    student_balance_before = _balance(db_session, student["id"])
    teacher_balance_before = _balance(db_session, teacher["id"])

    resp = client.put(
        f"/api/v1/lessons/{lesson['id']}/attendance/{student['id']}",
        headers=teacher_headers,
        json={"status": "present", "grade": 4},
    )
    assert resp.status_code == 200, resp.text

    assert _balance(db_session, student["id"]) == student_balance_before - 50000
    assert _balance(db_session, teacher["id"]) == teacher_balance_before + 20000


def test_present_to_excused_refunds_student_and_claws_back_teacher(client, superadmin_headers, admin_headers, db_session):
    teacher, group, lesson, students, teacher_headers = _setup_lesson_with_attendance(
        client, superadmin_headers, admin_headers, teacher_phone="+998900500005", student_phones=["+998900500006"]
    )
    student = students[0]

    resp = client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "present", "grade": 5}]},
    )
    assert resp.status_code == 201, resp.text

    student_balance_before = _balance(db_session, student["id"])
    teacher_balance_before = _balance(db_session, teacher["id"])

    resp = client.put(
        f"/api/v1/lessons/{lesson['id']}/attendance/{student['id']}",
        headers=teacher_headers,
        json={"status": "excused"},
    )
    assert resp.status_code == 200, resp.text

    assert _balance(db_session, student["id"]) == student_balance_before + 50000
    assert _balance(db_session, teacher["id"]) == teacher_balance_before - 20000


def test_frozen_student_is_never_charged_even_after_edit(client, superadmin_headers, admin_headers, db_session):
    teacher, group, lesson, students, teacher_headers = _setup_lesson_with_attendance(
        client, superadmin_headers, admin_headers, teacher_phone="+998900500007", student_phones=["+998900500008"]
    )
    student = students[0]

    group_student = (
        db_session.query(GroupStudent)
        .filter(GroupStudent.group_id == group["id"], GroupStudent.student_id == student["id"])
        .first()
    )
    group_student.status = GroupStudentStatus.frozen
    db_session.commit()

    resp = client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "excused"}]},
    )
    assert resp.status_code == 201, resp.text

    student_balance_before = _balance(db_session, student["id"])

    resp = client.put(
        f"/api/v1/lessons/{lesson['id']}/attendance/{student['id']}",
        headers=teacher_headers,
        json={"status": "present", "grade": 5},
    )
    assert resp.status_code == 200, resp.text

    assert _balance(db_session, student["id"]) == student_balance_before


def test_teacher_blocked_after_24h_but_admin_can_still_correct(client, superadmin_headers, admin_headers, db_session):
    teacher, group, lesson, students, teacher_headers = _setup_lesson_with_attendance(
        client, superadmin_headers, admin_headers, teacher_phone="+998900500009", student_phones=["+998900500010"]
    )
    student = students[0]

    resp = client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "present", "grade": 5}]},
    )
    assert resp.status_code == 201, resp.text

    attendance = (
        db_session.query(Attendance)
        .filter(Attendance.lesson_id == lesson["id"], Attendance.student_id == student["id"])
        .first()
    )
    attendance.created_at = datetime.now(timezone.utc) - timedelta(hours=25)
    db_session.commit()

    resp = client.put(
        f"/api/v1/lessons/{lesson['id']}/attendance/{student['id']}",
        headers=teacher_headers,
        json={"status": "excused"},
    )
    assert resp.status_code == 403, resp.text

    resp = client.put(
        f"/api/v1/lessons/{lesson['id']}/attendance/{student['id']}",
        headers=admin_headers,
        json={"status": "excused"},
    )
    assert resp.status_code == 200, resp.text
