import json

from tests.conftest import make_group, make_staff, make_student, make_subject


def test_blocking_a_student_writes_an_audit_log_entry(client, superadmin_headers, admin_headers):
    student = make_student(client, admin_headers, phone="+998900600001")

    resp = client.put(
        f"/api/v1/students/{student['id']}/status",
        headers=admin_headers,
        json={"is_active": False},
    )
    assert resp.status_code == 200, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    entry = next(l for l in logs if l["action"] == "student.blocked" and l["target_id"] == student["id"])
    assert entry["target_type"] == "student"
    assert entry["actor_name"] is not None


def test_deleting_and_restoring_a_student_writes_audit_log_entries(client, superadmin_headers, admin_headers):
    student = make_student(client, admin_headers, phone="+998900600002")

    resp = client.delete(f"/api/v1/students/{student['id']}", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    resp = client.put(f"/api/v1/students/{student['id']}/restore", headers=admin_headers)
    assert resp.status_code == 200, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    actions = [l["action"] for l in logs if l["target_id"] == student["id"]]
    assert "student.deleted" in actions
    assert "student.restored" in actions


def test_staff_block_delete_restore_and_password_change_write_audit_log_entries(
    client, superadmin_headers, admin_headers
):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900600003")

    resp = client.put(
        f"/api/v1/admin/users/{teacher['id']}/status",
        headers=superadmin_headers,
        json={"is_active": False},
    )
    assert resp.status_code == 200, resp.text
    resp = client.delete(f"/api/v1/admin/users/{teacher['id']}", headers=superadmin_headers)
    assert resp.status_code == 200, resp.text
    resp = client.put(f"/api/v1/admin/users/{teacher['id']}/restore", headers=superadmin_headers)
    assert resp.status_code == 200, resp.text
    resp = client.put(
        f"/api/v1/admin/users/{teacher['id']}/password",
        headers=superadmin_headers,
        json={"new_password": "newpass123"},
    )
    assert resp.status_code == 200, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    actions = [l["action"] for l in logs if l["target_id"] == teacher["id"]]
    assert "staff.blocked" in actions
    assert "staff.deleted" in actions
    assert "staff.restored" in actions
    assert "user.password_changed" in actions


def test_only_superadmin_can_view_audit_logs(client, admin_headers):
    resp = client.get("/api/v1/admin/audit-logs", headers=admin_headers)
    assert resp.status_code == 403, resp.text


def test_changing_teacher_percentage_writes_an_audit_log_entry_with_old_and_new_value(
    client, superadmin_headers
):
    teacher = make_staff(
        client, superadmin_headers, role="teacher", phone="+998900600004", teacher_percentage=40
    )

    resp = client.put(
        f"/api/v1/admin/users/{teacher['id']}",
        headers=superadmin_headers,
        json={
            "full_name": teacher["full_name"],
            "phone": teacher["phone"],
            "teacher_percentage": 55,
        },
    )
    assert resp.status_code == 200, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    entry = next(
        l for l in logs if l["action"] == "teacher.percentage_changed" and l["target_id"] == teacher["id"]
    )
    assert entry["details"] is not None
    details = json.loads(entry["details"])
    assert details == {"old": 40.0, "new": 55}


def test_updating_teacher_without_changing_percentage_does_not_write_an_audit_log_entry(
    client, superadmin_headers
):
    teacher = make_staff(
        client, superadmin_headers, role="teacher", phone="+998900600005", teacher_percentage=40
    )

    resp = client.put(
        f"/api/v1/admin/users/{teacher['id']}",
        headers=superadmin_headers,
        json={
            "full_name": "Changed Name",
            "phone": teacher["phone"],
            "teacher_percentage": 40,
        },
    )
    assert resp.status_code == 200, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    assert not any(
        l["action"] == "teacher.percentage_changed" and l["target_id"] == teacher["id"] for l in logs
    )


def test_changing_group_price_writes_an_audit_log_entry(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900600006")
    subject = make_subject(client, admin_headers, "Audit-Subject")
    group = make_group(
        client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"], lesson_price=30000
    )

    resp = client.put(
        f"/api/v1/groups/{group['id']}",
        headers=admin_headers,
        json={
            "name": group["name"],
            "subject_id": subject["id"],
            "teacher_id": teacher["id"],
            "lesson_price": 45000,
            "schedule": [],
        },
    )
    assert resp.status_code == 200, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    entry = next(
        l for l in logs if l["action"] == "group.price_changed" and l["target_id"] == group["id"]
    )
    assert json.loads(entry["details"]) == {"old": 30000, "new": 45000}


def test_reassigning_a_groups_teacher_writes_an_audit_log_entry(client, superadmin_headers, admin_headers):
    teacher_a = make_staff(client, superadmin_headers, role="teacher", phone="+998900600007")
    teacher_b = make_staff(client, superadmin_headers, role="teacher", phone="+998900600008")
    subject = make_subject(client, admin_headers, "Audit-Subject-2")
    group = make_group(client, admin_headers, subject_id=subject["id"], teacher_id=teacher_a["id"])

    resp = client.put(
        f"/api/v1/groups/{group['id']}",
        headers=admin_headers,
        json={
            "name": group["name"],
            "subject_id": subject["id"],
            "teacher_id": teacher_b["id"],
            "lesson_price": group["lesson_price"],
            "schedule": [],
        },
    )
    assert resp.status_code == 200, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    entry = next(
        l for l in logs if l["action"] == "group.teacher_reassigned" and l["target_id"] == group["id"]
    )
    assert json.loads(entry["details"]) == {
        "old_teacher_id": teacher_a["id"],
        "new_teacher_id": teacher_b["id"],
    }


def test_changing_group_status_writes_an_audit_log_entry(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900600009")
    subject = make_subject(client, admin_headers, "Audit-Subject-3")
    group = make_group(client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"])

    resp = client.put(
        f"/api/v1/groups/{group['id']}/status", headers=admin_headers, json={"status": "frozen"}
    )
    assert resp.status_code == 200, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    entry = next(
        l for l in logs if l["action"] == "group.status_changed" and l["target_id"] == group["id"]
    )
    assert json.loads(entry["details"]) == {"old": "active", "new": "frozen"}
