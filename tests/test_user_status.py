from tests.conftest import auth_headers, login, make_group, make_staff, make_student, make_subject


def test_admin_cannot_block_teacher_but_superadmin_can(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400001")

    resp = client.put(
        f"/api/v1/admin/users/{teacher['id']}/status",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert resp.status_code == 403, resp.text

    resp = client.put(
        f"/api/v1/admin/users/{teacher['id']}/status",
        headers=superadmin_headers,
        json={"is_active": False},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["is_active"] is False


def test_blocked_teacher_cannot_login_and_existing_token_is_rejected(client, superadmin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400002")
    teacher_token = login(client, teacher["phone"], "pass123")

    resp = client.put(
        f"/api/v1/admin/users/{teacher['id']}/status",
        headers=superadmin_headers,
        json={"is_active": False},
    )
    assert resp.status_code == 200

    resp = client.post(
        "/api/v1/auth/login",
        data={"username": teacher["phone"], "password": "pass123"},
    )
    assert resp.status_code == 403, resp.text

    # a token issued before the block must stop working immediately, not just at next login
    resp = client.get("/api/v1/auth/me", headers=auth_headers(teacher_token))
    assert resp.status_code == 403, resp.text


def test_staff_status_endpoint_rejects_student_target(client, superadmin_headers, admin_headers):
    student = make_student(client, admin_headers, phone="+998900400003")

    resp = client.put(
        f"/api/v1/admin/users/{student['id']}/status",
        headers=superadmin_headers,
        json={"is_active": False},
    )
    assert resp.status_code == 404, resp.text


def test_blocked_teacher_cannot_be_assigned_to_a_group(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400004")
    subject = make_subject(client, admin_headers, "Geography")

    client.put(
        f"/api/v1/admin/users/{teacher['id']}/status",
        headers=superadmin_headers,
        json={"is_active": False},
    )

    resp = client.post(
        "/api/v1/groups",
        headers=admin_headers,
        json={
            "name": "G-blocked-teacher",
            "subject_id": subject["id"],
            "teacher_id": teacher["id"],
            "lesson_price": 30000,
        },
    )
    assert resp.status_code == 400, resp.text


def test_admin_can_block_student_and_blocked_student_cannot_join_group(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400005")
    student = make_student(client, admin_headers, phone="+998900400006")
    subject = make_subject(client, admin_headers, "Art")
    group = make_group(
        client,
        admin_headers,
        subject_id=subject["id"],
        teacher_id=teacher["id"],
    )

    resp = client.put(
        f"/api/v1/students/{student['id']}/status",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert resp.status_code == 200, resp.text

    resp = client.post(
        "/api/v1/auth/login",
        data={"username": student["phone"], "password": "pass123"},
    )
    assert resp.status_code == 403, resp.text

    resp = client.post(
        f"/api/v1/groups/{group['id']}/students",
        headers=admin_headers,
        json={"student_id": student["id"]},
    )
    assert resp.status_code == 400, resp.text
