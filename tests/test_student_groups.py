from tests.conftest import add_student_to_group, make_group, make_lesson, make_staff, make_student, make_subject


def test_student_groups_lists_enrollment_with_attendance_and_spend(
    client, superadmin_headers, admin_headers
):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900700001")
    subject = make_subject(client, admin_headers, "Student-Groups")
    group = make_group(
        client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"], lesson_price=20000
    )
    student = make_student(client, admin_headers, phone="+998900700002")
    client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers=admin_headers,
        json={"amount": 500000},
    )
    add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])

    lesson1 = make_lesson(client, admin_headers, group_id=group["id"], lesson_date="2026-10-09")
    lesson2 = make_lesson(client, admin_headers, group_id=group["id"], lesson_date="2026-10-10")

    teacher_headers_login = client.post(
        "/api/v1/auth/login", data={"username": teacher["phone"], "password": "pass123"}
    )
    teacher_headers = {"Authorization": f"Bearer {teacher_headers_login.json()['access_token']}"}

    for lesson, lesson_status in ((lesson1, "present"), (lesson2, "unexcused")):
        resp = client.post(
            f"/api/v1/lessons/{lesson['id']}/attendance",
            headers=teacher_headers,
            json={"records": [{"student_id": student["id"], "status": lesson_status, **({"grade": 5} if lesson_status == "present" else {})}]},
        )
        assert resp.status_code == 201, resp.text

    resp = client.get(f"/api/v1/students/{student['id']}/groups", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert len(data) == 1
    row = data[0]
    assert row["group_id"] == group["id"]
    assert row["subject_name"] == "Student-Groups"
    assert row["teacher_name"] == teacher["full_name"]
    assert row["status"] == "active"
    assert row["attendance_rate"] == 50.0
    assert row["total_spent"] == 40000.0


def test_student_groups_empty_when_not_enrolled(client, admin_headers):
    student = make_student(client, admin_headers, phone="+998900700003")

    resp = client.get(f"/api/v1/students/{student['id']}/groups", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_student_cannot_view_another_students_groups(client, admin_headers):
    student_a = make_student(client, admin_headers, phone="+998900700004")
    student_b = make_student(client, admin_headers, phone="+998900700005")

    login_resp = client.post(
        "/api/v1/auth/login", data={"username": student_a["phone"], "password": "pass123"}
    )
    student_headers = {"Authorization": f"Bearer {login_resp.json()['access_token']}"}

    resp = client.get(f"/api/v1/students/{student_b['id']}/groups", headers=student_headers)
    assert resp.status_code == 403, resp.text
