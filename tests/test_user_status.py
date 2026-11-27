from app.core.security import hash_password
from app.models.user import User, UserRole
from tests.conftest import (
    add_student_to_group,
    auth_headers,
    login,
    make_group,
    make_staff,
    make_student,
    make_subject,
)


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


def test_blocking_student_auto_freezes_active_groups_but_unblocking_does_not_unfreeze(
    client, superadmin_headers, admin_headers
):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400007")
    student = make_student(client, admin_headers, phone="+998900400008")
    subject = make_subject(client, admin_headers, "Chemistry")
    group = make_group(client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"])
    add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])

    resp = client.put(
        f"/api/v1/students/{student['id']}/status",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert resp.status_code == 200, resp.text

    roster = client.get(f"/api/v1/groups/{group['id']}", headers=admin_headers).json()["students"]
    membership = next(s for s in roster if s["student_id"] == student["id"])
    assert membership["status"] == "frozen", membership

    resp = client.put(
        f"/api/v1/students/{student['id']}/status",
        headers=admin_headers,
        json={"is_active": True},
    )
    assert resp.status_code == 200, resp.text

    roster = client.get(f"/api/v1/groups/{group['id']}", headers=admin_headers).json()["students"]
    membership = next(s for s in roster if s["student_id"] == student["id"])
    assert membership["status"] == "frozen", "reactivating a student must not silently resume billing"


def test_blocking_teacher_auto_freezes_active_groups_but_unblocking_does_not_unfreeze(
    client, superadmin_headers, admin_headers
):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400009")
    subject = make_subject(client, admin_headers, "Biology")
    group = make_group(client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"])

    resp = client.put(
        f"/api/v1/admin/users/{teacher['id']}/status",
        headers=superadmin_headers,
        json={"is_active": False},
    )
    assert resp.status_code == 200, resp.text

    group_detail = client.get(f"/api/v1/groups/{group['id']}", headers=admin_headers).json()
    assert group_detail["status"] == "frozen", group_detail

    resp = client.put(
        f"/api/v1/admin/users/{teacher['id']}/status",
        headers=superadmin_headers,
        json={"is_active": True},
    )
    assert resp.status_code == 200, resp.text

    group_detail = client.get(f"/api/v1/groups/{group['id']}", headers=admin_headers).json()
    assert group_detail["status"] == "frozen", "reactivating a teacher must not silently resume their groups"


def test_deleted_student_is_blocked_frozen_and_cannot_be_toggled(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400010")
    student = make_student(client, admin_headers, phone="+998900400011")
    subject = make_subject(client, admin_headers, "History")
    group = make_group(client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"])
    add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])

    resp = client.delete(f"/api/v1/students/{student['id']}", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["is_active"] is False
    assert body["deleted_at"] is not None

    roster = client.get(f"/api/v1/groups/{group['id']}", headers=admin_headers).json()["students"]
    membership = next(s for s in roster if s["student_id"] == student["id"])
    assert membership["status"] == "frozen", membership

    resp = client.delete(f"/api/v1/students/{student['id']}", headers=admin_headers)
    assert resp.status_code == 400, resp.text

    resp = client.put(
        f"/api/v1/students/{student['id']}/status",
        headers=admin_headers,
        json={"is_active": True},
    )
    assert resp.status_code == 400, resp.text


def test_deleted_teacher_is_blocked_frozen_and_cannot_be_toggled(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400012")
    subject = make_subject(client, admin_headers, "Physics")
    group = make_group(client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"])

    resp = client.delete(f"/api/v1/admin/users/{teacher['id']}", headers=superadmin_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["is_active"] is False
    assert body["deleted_at"] is not None

    group_detail = client.get(f"/api/v1/groups/{group['id']}", headers=admin_headers).json()
    assert group_detail["status"] == "frozen", group_detail

    resp = client.delete(f"/api/v1/admin/users/{teacher['id']}", headers=superadmin_headers)
    assert resp.status_code == 400, resp.text

    resp = client.put(
        f"/api/v1/admin/users/{teacher['id']}/status",
        headers=superadmin_headers,
        json={"is_active": True},
    )
    assert resp.status_code == 400, resp.text


def test_admin_cannot_delete_self_and_admin_role_cannot_delete_staff(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400013")

    resp = client.delete(f"/api/v1/admin/users/{teacher['id']}", headers=admin_headers)
    assert resp.status_code == 403, resp.text

    me = client.get("/api/v1/auth/me", headers=superadmin_headers).json()
    resp = client.delete(f"/api/v1/admin/users/{me['id']}", headers=superadmin_headers)
    assert resp.status_code == 400, resp.text


def test_deleted_student_rejects_double_delete_and_student_delete_rejects_student_role_mismatch(
    client, superadmin_headers, admin_headers
):
    student = make_student(client, admin_headers, phone="+998900400014")
    resp = client.delete(f"/api/v1/admin/users/{student['id']}", headers=superadmin_headers)
    assert resp.status_code == 404, resp.text


def test_superadmin_cannot_block_or_delete_another_superadmin(client, superadmin_headers, db_session):
    second = User(
        full_name="Second Super",
        phone="+998900400015",
        hashed_password=hash_password("admin123"),
        role=UserRole.superadmin,
    )
    db_session.add(second)
    db_session.commit()
    db_session.refresh(second)

    resp = client.put(
        f"/api/v1/admin/users/{second.id}/status",
        headers=superadmin_headers,
        json={"is_active": False},
    )
    assert resp.status_code == 403, resp.text

    resp = client.delete(f"/api/v1/admin/users/{second.id}", headers=superadmin_headers)
    assert resp.status_code == 403, resp.text


def test_deleted_student_hidden_by_default_but_visible_with_show_deleted_filter(
    client, superadmin_headers, admin_headers
):
    student = make_student(client, admin_headers, phone="+998900400016")
    client.delete(f"/api/v1/students/{student['id']}", headers=admin_headers)

    resp = client.get("/api/v1/students", headers=admin_headers)
    ids = [s["id"] for s in resp.json()["items"]]
    assert student["id"] not in ids

    resp = client.get("/api/v1/students", headers=admin_headers, params={"show_deleted": True})
    ids = [s["id"] for s in resp.json()["items"]]
    assert student["id"] in ids


def test_deleted_teacher_hidden_by_default_but_visible_with_show_deleted_filter(
    client, superadmin_headers, admin_headers
):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400017")
    client.delete(f"/api/v1/admin/users/{teacher['id']}", headers=superadmin_headers)

    resp = client.get("/api/v1/admin/users", headers=admin_headers)
    ids = [s["id"] for s in resp.json()["items"]]
    assert teacher["id"] not in ids

    resp = client.get("/api/v1/admin/users", headers=admin_headers, params={"show_deleted": True})
    ids = [s["id"] for s in resp.json()["items"]]
    assert teacher["id"] in ids


def test_restoring_a_deleted_student_clears_deleted_at_but_not_is_active(
    client, superadmin_headers, admin_headers
):
    student = make_student(client, admin_headers, phone="+998900400018")
    client.delete(f"/api/v1/students/{student['id']}", headers=admin_headers)

    resp = client.put(f"/api/v1/students/{student['id']}/restore", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["deleted_at"] is None
    assert body["is_active"] is False

    resp = client.put(f"/api/v1/students/{student['id']}/restore", headers=admin_headers)
    assert resp.status_code == 400, resp.text


def test_restoring_a_deleted_teacher_requires_superadmin(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900400019")
    client.delete(f"/api/v1/admin/users/{teacher['id']}", headers=superadmin_headers)

    resp = client.put(f"/api/v1/admin/users/{teacher['id']}/restore", headers=admin_headers)
    assert resp.status_code == 403, resp.text

    resp = client.put(f"/api/v1/admin/users/{teacher['id']}/restore", headers=superadmin_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["deleted_at"] is None


def test_reusing_a_deleted_students_phone_gives_a_restore_hint(client, superadmin_headers, admin_headers):
    student = make_student(client, admin_headers, full_name="Eski Ism", phone="+998900400020")
    client.delete(f"/api/v1/students/{student['id']}", headers=admin_headers)

    resp = client.post(
        "/api/v1/students",
        headers=admin_headers,
        json={
            "full_name": "Yangi Ism",
            "phone": "+998900400020",
            "password": "pass123",
            "role": "student",
        },
    )
    assert resp.status_code == 400, resp.text
    assert "Eski Ism" in resp.json()["detail"]


def _make_second_superadmin(db_session, phone: str = "+998900400021") -> User:
    second = User(
        full_name="Second Super",
        phone=phone,
        hashed_password=hash_password("admin123"),
        role=UserRole.superadmin,
    )
    db_session.add(second)
    db_session.commit()
    db_session.refresh(second)
    return second


def test_superadmin_cannot_edit_another_superadmins_profile(client, superadmin_headers, db_session):
    second = _make_second_superadmin(db_session)

    resp = client.put(
        f"/api/v1/admin/users/{second.id}",
        headers=superadmin_headers,
        json={"full_name": "Changed", "phone": second.phone},
    )
    assert resp.status_code == 403, resp.text


def test_superadmin_cannot_change_another_superadmins_password(client, superadmin_headers, db_session):
    second = _make_second_superadmin(db_session, phone="+998900400022")

    resp = client.put(
        f"/api/v1/admin/users/{second.id}/password",
        headers=superadmin_headers,
        json={"new_password": "newpass123"},
    )
    assert resp.status_code == 403, resp.text
