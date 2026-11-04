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


def test_admin_cannot_change_admin_or_superadmin_password(client, superadmin, superadmin_headers, admin_headers):
    other_admin = make_staff(client, superadmin_headers, role="admin", phone="+998900200001")
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900200002")

    resp = client.put(
        f"/api/v1/admin/users/{other_admin['id']}/password",
        headers=admin_headers,
        json={"new_password": "hacked123"},
    )
    assert resp.status_code == 403, resp.text

    resp = client.put(
        f"/api/v1/admin/users/{superadmin.id}/password",
        headers=admin_headers,
        json={"new_password": "hacked123"},
    )
    assert resp.status_code == 403, resp.text

    # admin can still reset a teacher's password (allowed scope)
    resp = client.put(
        f"/api/v1/admin/users/{teacher['id']}/password",
        headers=admin_headers,
        json={"new_password": "newpass123"},
    )
    assert resp.status_code == 200, resp.text


def test_admin_cannot_edit_or_block_staff_profiles(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900200003")

    resp = client.put(
        f"/api/v1/admin/users/{teacher['id']}",
        headers=admin_headers,
        json={"full_name": "Hacked", "phone": teacher["phone"], "teacher_percentage": 99},
    )
    assert resp.status_code == 403, resp.text

    resp = client.put(
        f"/api/v1/admin/users/{teacher['id']}/status",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert resp.status_code == 403, resp.text


def test_superadmin_cannot_block_self(client, superadmin, superadmin_headers):
    resp = client.put(
        f"/api/v1/admin/users/{superadmin.id}/status",
        headers=superadmin_headers,
        json={"is_active": False},
    )
    assert resp.status_code == 400, resp.text


def test_admin_sees_lesson_driven_transactions_not_just_own_deposits(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900200004")
    student = make_student(client, admin_headers, phone="+998900200005")
    client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers=admin_headers,
        json={"amount": 100000},
    )
    subject = make_subject(client, admin_headers, "Chemistry")
    group = make_group(
        client,
        admin_headers,
        subject_id=subject["id"],
        teacher_id=teacher["id"],
        lesson_price=30000,
    )
    add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])
    lesson = make_lesson(client, admin_headers, group_id=group["id"])

    teacher_headers = auth_headers(login(client, teacher["phone"], "pass123"))
    resp = client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "present", "grade": 5}]},
    )
    assert resp.status_code == 201, resp.text

    # the deduction was authored by the teacher, not the admin - admin must still see it
    resp = client.get("/api/v1/transactions", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    types = {t["type"] for t in body["items"]}
    assert "deposit" in types
    assert "deduction" in types
    assert body["total_deposits"] == 100000.0
    assert body["total_deductions"] == 30000.0

    # the lesson_earning has created_by_id = None - admin must still see it
    resp = client.get("/api/v1/teachers/transactions", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    tt_types = {t["type"] for t in resp.json()["items"]}
    assert "lesson_earning" in tt_types
