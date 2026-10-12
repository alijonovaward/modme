from tests.conftest import login


def test_full_lesson_flow(client, superadmin):
    admin_token = login(client, "+998900000001", "admin123")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    teacher_resp = client.post(
        "/api/v1/admin/users",
        headers=admin_headers,
        json={
            "full_name": "Teacher",
            "phone": "+998901000000",
            "password": "pass123",
            "role": "teacher",
            "teacher_percentage": 40,
        },
    )
    assert teacher_resp.status_code == 201, teacher_resp.text
    teacher_id = teacher_resp.json()["id"]

    student_resp = client.post(
        "/api/v1/students",
        headers=admin_headers,
        json={
            "full_name": "Student",
            "phone": "+998902000000",
            "password": "pass123",
            "role": "student",
        },
    )
    assert student_resp.status_code == 201, student_resp.text
    student_id = student_resp.json()["id"]

    deposit_resp = client.post(
        f"/api/v1/students/{student_id}/deposit",
        headers=admin_headers,
        json={"amount": 100000},
    )
    assert deposit_resp.status_code == 201, deposit_resp.text

    subject_resp = client.post(
        "/api/v1/subjects", headers=admin_headers, json={"name": "Math"}
    )
    subject_id = subject_resp.json()["id"]

    group_resp = client.post(
        "/api/v1/groups",
        headers=admin_headers,
        json={
            "name": "Math-101",
            "subject_id": subject_id,
            "teacher_id": teacher_id,
            "lesson_price": 50000,
        },
    )
    assert group_resp.status_code == 201, group_resp.text
    group_id = group_resp.json()["id"]

    add_student_resp = client.post(
        f"/api/v1/groups/{group_id}/students",
        headers=admin_headers,
        json={"student_id": student_id},
    )
    assert add_student_resp.status_code == 201, add_student_resp.text

    lesson_resp = client.post(
        "/api/v1/lessons",
        headers=admin_headers,
        json={"group_id": group_id, "lesson_date": "2026-10-09"},
    )
    assert lesson_resp.status_code == 201, lesson_resp.text
    lesson_id = lesson_resp.json()["id"]

    teacher_token = login(client, "+998901000000", "pass123")
    teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

    attendance_resp = client.post(
        f"/api/v1/lessons/{lesson_id}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student_id, "status": "present", "grade": 5}]},
    )
    assert attendance_resp.status_code == 201, attendance_resp.text

    transactions_resp = client.get(
        f"/api/v1/students/{student_id}/transactions", headers=admin_headers
    )
    transactions = transactions_resp.json()
    assert len(transactions) == 2
    deduction = next(t for t in transactions if t["type"] == "deduction")
    assert deduction["amount"] == -50000.0

    finance_resp = client.get("/api/v1/teachers/finance", headers=teacher_headers)
    finance = finance_resp.json()
    assert len(finance) == 1
    assert finance[0]["amount"] == 20000.0


def test_excused_absence_does_not_charge(client, superadmin):
    admin_token = login(client, "+998900000001", "admin123")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    teacher_resp = client.post(
        "/api/v1/admin/users",
        headers=admin_headers,
        json={
            "full_name": "Teacher2",
            "phone": "+998901000001",
            "password": "pass123",
            "role": "teacher",
            "teacher_percentage": 40,
        },
    )
    teacher_id = teacher_resp.json()["id"]

    student_resp = client.post(
        "/api/v1/students",
        headers=admin_headers,
        json={
            "full_name": "Student2",
            "phone": "+998902000001",
            "password": "pass123",
            "role": "student",
        },
    )
    student_id = student_resp.json()["id"]

    client.post(
        f"/api/v1/students/{student_id}/deposit",
        headers=admin_headers,
        json={"amount": 100000},
    )

    subject_id = client.post(
        "/api/v1/subjects", headers=admin_headers, json={"name": "Physics"}
    ).json()["id"]

    group_id = client.post(
        "/api/v1/groups",
        headers=admin_headers,
        json={
            "name": "Phys-101",
            "subject_id": subject_id,
            "teacher_id": teacher_id,
            "lesson_price": 30000,
        },
    ).json()["id"]

    client.post(
        f"/api/v1/groups/{group_id}/students",
        headers=admin_headers,
        json={"student_id": student_id},
    )

    lesson_id = client.post(
        "/api/v1/lessons",
        headers=admin_headers,
        json={"group_id": group_id, "lesson_date": "2026-10-09"},
    ).json()["id"]

    teacher_token = login(client, "+998901000001", "pass123")
    attendance_resp = client.post(
        f"/api/v1/lessons/{lesson_id}/attendance",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json={"records": [{"student_id": student_id, "status": "excused"}]},
    )
    assert attendance_resp.status_code == 201, attendance_resp.text

    transactions = client.get(
        f"/api/v1/students/{student_id}/transactions", headers=admin_headers
    ).json()
    assert len(transactions) == 1
    assert transactions[0]["type"] == "deposit"

    finance = client.get(
        "/api/v1/teachers/finance",
        headers={"Authorization": f"Bearer {teacher_token}"},
    ).json()
    assert len(finance) == 0
