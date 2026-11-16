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


def test_teacher_stats_counts_active_students_lessons_and_attendance_rate(
    client, superadmin_headers, admin_headers
):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900600001")
    subject = make_subject(client, admin_headers, "Teacher-Stats")
    group = make_group(client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"])

    student_a = make_student(client, admin_headers, phone="+998900600002")
    student_b = make_student(client, admin_headers, phone="+998900600003")
    for student in (student_a, student_b):
        client.post(
            f"/api/v1/students/{student['id']}/deposit",
            headers=admin_headers,
            json={"amount": 500000},
        )
        add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])

    lesson = make_lesson(client, admin_headers, group_id=group["id"])
    teacher_headers = auth_headers(login(client, teacher["phone"], "pass123"))
    resp = client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={
            "records": [
                {"student_id": student_a["id"], "status": "present", "grade": 5},
                {"student_id": student_b["id"], "status": "unexcused"},
            ]
        },
    )
    assert resp.status_code == 201, resp.text

    resp = client.get(f"/api/v1/teachers/{teacher['id']}/stats", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["active_student_count"] == 2
    assert data["completed_lesson_count"] == 1
    assert data["attendance_rate"] == 50.0


def test_teacher_stats_for_teacher_with_no_data(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900600004")

    resp = client.get(f"/api/v1/teachers/{teacher['id']}/stats", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["active_student_count"] == 0
    assert data["completed_lesson_count"] == 0
    assert data["attendance_rate"] == 0.0
