from tests.conftest import add_student_to_group, auth_headers, login, make_group, make_lesson, make_staff, make_student, make_subject


def test_attendance_grid_returns_lessons_students_and_cells(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998901100001")
    subject = make_subject(client, admin_headers, "Attendance-Grid")
    group = make_group(client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"])

    student_a = make_student(client, admin_headers, phone="+998901100002")
    student_b = make_student(client, admin_headers, phone="+998901100003")
    for student in (student_a, student_b):
        client.post(
            f"/api/v1/students/{student['id']}/deposit",
            headers=admin_headers,
            json={"amount": 500000},
        )
        add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])

    lesson1 = make_lesson(client, admin_headers, group_id=group["id"], lesson_date="2026-10-09")
    lesson2 = make_lesson(client, admin_headers, group_id=group["id"], lesson_date="2026-10-16")

    teacher_headers = auth_headers(login(client, teacher["phone"], "pass123"))
    resp = client.post(
        f"/api/v1/lessons/{lesson1['id']}/attendance",
        headers=teacher_headers,
        json={
            "records": [
                {"student_id": student_a["id"], "status": "present", "correct_count": 5, "total_count": 5},
                {"student_id": student_b["id"], "status": "unexcused"},
            ]
        },
    )
    assert resp.status_code == 201, resp.text

    resp = client.get(f"/api/v1/groups/{group['id']}/attendance-grid", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()

    assert [lesson["id"] for lesson in data["lessons"]] == [lesson1["id"], lesson2["id"]]
    assert data["lessons"][1]["status"] == "planned"

    student_ids = {s["student_id"] for s in data["students"]}
    assert student_ids == {student_a["id"], student_b["id"]}

    cells_by_key = {(c["student_id"], c["lesson_id"]): c for c in data["cells"]}
    assert cells_by_key[(student_a["id"], lesson1["id"])]["status"] == "present"
    assert cells_by_key[(student_b["id"], lesson1["id"])]["status"] == "unexcused"
    assert (student_a["id"], lesson2["id"]) not in cells_by_key

    resp = client.get(
        f"/api/v1/groups/{group['id']}/attendance-grid",
        headers=admin_headers,
        params={"date_from": "2026-10-10", "date_to": "2026-10-20"},
    )
    assert resp.status_code == 200, resp.text
    filtered = resp.json()
    assert [lesson["id"] for lesson in filtered["lessons"]] == [lesson2["id"]]


def test_teacher_cannot_see_another_teachers_attendance_grid(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998901100004")
    other_teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998901100005")
    subject = make_subject(client, admin_headers, "Attendance-Grid-2")
    group = make_group(client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"])

    other_teacher_headers = auth_headers(login(client, other_teacher["phone"], "pass123"))
    resp = client.get(
        f"/api/v1/groups/{group['id']}/attendance-grid", headers=other_teacher_headers
    )
    assert resp.status_code == 403, resp.text
