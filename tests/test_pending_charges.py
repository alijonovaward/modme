from app.models.user import User
from tests.conftest import (
    add_student_to_group,
    auth_headers,
    login,
    make_group,
    make_lesson,
    make_staff,
    make_student,
    make_subject,
)


def _setup(client, superadmin_headers, admin_headers, *, teacher_phone, student_phone, lesson_price=50000, deposit=10000):
    teacher = make_staff(
        client, superadmin_headers, role="teacher", phone=teacher_phone, teacher_percentage=40
    )
    subject = make_subject(client, admin_headers, "Pending-Charges")
    group = make_group(
        client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"], lesson_price=lesson_price
    )
    student = make_student(client, admin_headers, phone=student_phone)
    if deposit:
        client.post(
            f"/api/v1/students/{student['id']}/deposit",
            headers=admin_headers,
            json={"amount": deposit},
        )
    add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])
    lesson = make_lesson(client, admin_headers, group_id=group["id"])
    teacher_headers = auth_headers(login(client, teacher["phone"], "pass123"))
    return teacher, group, student, lesson, teacher_headers


def _balance(db_session, user_id: int) -> float:
    db_session.expire_all()
    return db_session.get(User, user_id).balance


def test_insufficient_balance_deducts_directly_into_negative_balance(
    client, superadmin_headers, admin_headers, db_session
):
    teacher, group, student, lesson, teacher_headers = _setup(
        client,
        superadmin_headers,
        admin_headers,
        teacher_phone="+998900800001",
        student_phone="+998900800002",
        lesson_price=50000,
        deposit=10000,
    )

    resp = client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "present", "correct_count": 5, "total_count": 5}]},
    )
    assert resp.status_code == 201, resp.text

    # 10,000 deposit - 50,000 lesson price = -40,000 negative balance (debt)
    assert _balance(db_session, student["id"]) == -40000.0
    assert _balance(db_session, teacher["id"]) == 4000.0


def test_depositing_money_clears_negative_balance(
    client, superadmin_headers, admin_headers, db_session
):
    teacher, group, student, lesson, teacher_headers = _setup(
        client,
        superadmin_headers,
        admin_headers,
        teacher_phone="+998900800003",
        student_phone="+998900800004",
        lesson_price=50000,
        deposit=0,
    )

    client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "present", "correct_count": 5, "total_count": 5}]},
    )
    assert _balance(db_session, student["id"]) == -50000.0

    resp = client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers=admin_headers,
        json={"amount": 80000},
    )
    assert resp.status_code == 201, resp.text

    # -50,000 debt + 80,000 deposit = +30,000 balance
    assert _balance(db_session, student["id"]) == 30000.0
    assert _balance(db_session, teacher["id"]) == 20000.0


def test_cancelling_attendance_refunds_deducted_balance(
    client, superadmin_headers, admin_headers, db_session
):
    teacher, group, student, lesson, teacher_headers = _setup(
        client,
        superadmin_headers,
        admin_headers,
        teacher_phone="+998900800005",
        student_phone="+998900800006",
        lesson_price=50000,
        deposit=10000,
    )

    client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "present", "correct_count": 5, "total_count": 5}]},
    )
    assert _balance(db_session, student["id"]) == -40000.0

    resp = client.put(
        f"/api/v1/lessons/{lesson['id']}/attendance/{student['id']}",
        headers=teacher_headers,
        json={"status": "excused"},
    )
    assert resp.status_code == 200, resp.text

    # Refunded 50,000 brings balance back from -40,000 to +10,000
    assert _balance(db_session, student["id"]) == 10000.0
    assert _balance(db_session, teacher["id"]) == 0.0
