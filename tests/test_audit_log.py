import json
from datetime import date, timedelta

from tests.conftest import add_student_to_group, auth_headers, login, make_group, make_lesson, make_staff, make_student, make_subject


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


def test_manual_deposit_and_withdraw_appear_in_the_merged_audit_log(
    client, superadmin_headers, admin_headers
):
    student = make_student(client, admin_headers, phone="+998900600010")

    resp = client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers=admin_headers,
        json={"amount": 100000, "comment": "Naqd to'lov"},
    )
    assert resp.status_code == 201, resp.text

    resp = client.post(
        f"/api/v1/students/{student['id']}/withdraw",
        headers=admin_headers,
        json={"amount": 20000, "comment": "Ortiqcha to'lovni qaytarish"},
    )
    assert resp.status_code == 201, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    deposit_entries = [
        l for l in logs if l["action"] == "transaction.deposit" and l["target_id"] == student["id"]
    ]
    withdraw_entries = [
        l for l in logs if l["action"] == "transaction.withdraw" and l["target_id"] == student["id"]
    ]
    assert len(deposit_entries) == 1
    assert json.loads(deposit_entries[0]["details"]) == {"amount": 100000, "comment": "Naqd to'lov"}
    assert len(withdraw_entries) == 1
    assert json.loads(withdraw_entries[0]["details"]) == {
        "amount": -20000,
        "comment": "Ortiqcha to'lovni qaytarish",
    }


def test_teacher_payout_appears_in_the_merged_audit_log(client, superadmin_headers, admin_headers):
    # An admin's balance is allowed to go negative (a salary payout is a plain
    # expense, nothing ever credits it) - a fresh teacher's isn't, so this uses an
    # admin target to keep the test independent of any prior earnings.
    teacher = make_staff(client, superadmin_headers, role="admin", phone="+998900600011")

    resp = client.post(
        f"/api/v1/teachers/{teacher['id']}/payout",
        headers=superadmin_headers,
        json={"amount": 500000, "comment": "Oylik"},
    )
    assert resp.status_code == 201, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    entries = [
        l
        for l in logs
        if l["action"] == "teacher_transaction.payout" and l["target_id"] == teacher["id"]
    ]
    assert len(entries) == 1
    assert json.loads(entries[0]["details"]) == {"amount": -500000, "comment": "Oylik"}


def test_routine_lesson_charge_and_earning_do_not_appear_in_the_audit_log(
    client, superadmin_headers, admin_headers
):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900600012")
    student = make_student(client, admin_headers, phone="+998900600013")
    subject = make_subject(client, admin_headers, "Audit-Subject-4")
    group = make_group(
        client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"], lesson_price=50000
    )
    add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])
    client.post(
        f"/api/v1/students/{student['id']}/deposit", headers=admin_headers, json={"amount": 500000}
    )
    lesson = make_lesson(client, admin_headers, group_id=group["id"])
    teacher_headers = auth_headers(login(client, teacher["phone"], "pass123"))

    resp = client.post(
        f"/api/v1/lessons/{lesson['id']}/attendance",
        headers=teacher_headers,
        json={"records": [{"student_id": student["id"], "status": "present", "correct_count": 5, "total_count": 5}]},
    )
    assert resp.status_code == 201, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    # The earlier manual deposit must still show up - only the lesson charge/earning
    # that followed it must be excluded.
    student_entries = [l for l in logs if l["target_id"] == student["id"] and l["target_type"] == "student"]
    assert {l["action"] for l in student_entries} == {"student.created", "transaction.deposit"}
    # The teacher's own "staff.created" entry is expected - only their lesson-earning
    # credit (routine, automatic) must stay excluded.
    staff_entries = [l for l in logs if l["target_id"] == teacher["id"] and l["target_type"] == "staff"]
    assert {l["action"] for l in staff_entries} == {"staff.created"}


def test_updating_a_student_writes_an_audit_log_entry(client, superadmin_headers, admin_headers):
    student = make_student(client, admin_headers, full_name="Old Name", phone="+998900600015")

    resp = client.put(
        f"/api/v1/students/{student['id']}",
        headers=admin_headers,
        json={"full_name": "New Name", "phone": student["phone"]},
    )
    assert resp.status_code == 200, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    entry = next(l for l in logs if l["action"] == "student.updated" and l["target_id"] == student["id"])
    details = json.loads(entry["details"])
    assert details["old_full_name"] == "Old Name"
    assert details["new_full_name"] == "New Name"


def test_updating_a_staff_members_name_writes_an_audit_log_entry(client, superadmin_headers):
    teacher = make_staff(
        client, superadmin_headers, role="teacher", phone="+998900600016", full_name="Old Teacher"
    )

    resp = client.put(
        f"/api/v1/admin/users/{teacher['id']}",
        headers=superadmin_headers,
        json={
            "full_name": "New Teacher",
            "phone": teacher["phone"],
            "teacher_percentage": teacher["teacher_percentage"],
        },
    )
    assert resp.status_code == 200, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    entry = next(l for l in logs if l["action"] == "staff.updated" and l["target_id"] == teacher["id"])
    details = json.loads(entry["details"])
    assert details["old_full_name"] == "Old Teacher"
    assert details["new_full_name"] == "New Teacher"


def test_creating_a_group_writes_an_audit_log_entry(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900600017")
    subject = make_subject(client, admin_headers, "Audit-Subject-6")

    group = make_group(
        client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"], name="Audit Group"
    )

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    entry = next(l for l in logs if l["action"] == "group.created" and l["target_id"] == group["id"])
    details = json.loads(entry["details"])
    assert details["name"] == "Audit Group"


def test_updating_a_groups_name_writes_an_audit_log_entry(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900600018")
    subject = make_subject(client, admin_headers, "Audit-Subject-7")
    group = make_group(
        client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"], name="Old Group Name"
    )

    resp = client.put(
        f"/api/v1/groups/{group['id']}",
        headers=admin_headers,
        json={
            "name": "New Group Name",
            "subject_id": subject["id"],
            "teacher_id": teacher["id"],
            "lesson_price": group["lesson_price"],
            "schedule": [],
        },
    )
    assert resp.status_code == 200, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    entry = next(l for l in logs if l["action"] == "group.updated" and l["target_id"] == group["id"])
    details = json.loads(entry["details"])
    assert details["old_name"] == "Old Group Name"
    assert details["new_name"] == "New Group Name"


def test_dropping_a_student_from_a_group_writes_an_audit_log_entry(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900600019")
    student = make_student(client, admin_headers, phone="+998900600020")
    subject = make_subject(client, admin_headers, "Audit-Subject-8")
    group = make_group(client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"])
    add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])

    resp = client.put(
        f"/api/v1/groups/{group['id']}/students/{student['id']}",
        headers=admin_headers,
        json={"status": "dropped", "reason": "To'lamadi"},
    )
    assert resp.status_code == 200, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    entry = next(
        l for l in logs if l["action"] == "group_student.dropped" and l["target_id"] == student["id"]
    )
    details = json.loads(entry["details"])
    assert details["group_id"] == group["id"]
    assert details["reason"] == "To'lamadi"


def test_creating_and_deleting_a_subject_writes_audit_log_entries(client, superadmin_headers, admin_headers):
    subject = make_subject(client, admin_headers, "Audit-Subject-9")

    resp = client.delete(f"/api/v1/subjects/{subject['id']}", headers=admin_headers)
    assert resp.status_code == 204, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    created_entry = next(
        l for l in logs if l["action"] == "subject.created" and l["target_id"] == subject["id"]
    )
    assert json.loads(created_entry["details"]) == {"name": "Audit-Subject-9"}
    deleted_entry = next(
        l for l in logs if l["action"] == "subject.deleted" and l["target_id"] == subject["id"]
    )
    assert json.loads(deleted_entry["details"]) == {"name": "Audit-Subject-9"}


def test_creating_and_deleting_a_lesson_writes_audit_log_entries(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900600021")
    subject = make_subject(client, admin_headers, "Audit-Subject-10")
    group = make_group(client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"])

    lesson = make_lesson(client, admin_headers, group_id=group["id"], lesson_date="2026-10-20")

    resp = client.delete(f"/api/v1/lessons/{lesson['id']}", headers=admin_headers)
    assert resp.status_code == 204, resp.text

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    created_entry = next(
        l for l in logs if l["action"] == "lesson.created" and l["target_id"] == lesson["id"]
    )
    assert json.loads(created_entry["details"]) == {"group_id": group["id"], "lesson_date": "2026-10-20"}
    deleted_entry = next(
        l for l in logs if l["action"] == "lesson.deleted" and l["target_id"] == lesson["id"]
    )
    assert json.loads(deleted_entry["details"]) == {"group_id": group["id"], "lesson_date": "2026-10-20"}


def test_generating_group_lessons_writes_one_audit_log_entry(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900600022")
    subject = make_subject(client, admin_headers, "Audit-Subject-11")
    target_date = date.today() + timedelta(days=14)
    group = make_group(
        client,
        admin_headers,
        subject_id=subject["id"],
        teacher_id=teacher["id"],
        schedule=[
            {
                "weekday": target_date.weekday(),
                "start_time": "10:00",
                "end_time": "11:00",
            }
        ],
    )

    resp = client.post(
        f"/api/v1/groups/{group['id']}/lessons/generate",
        headers=admin_headers,
        json={"date_from": str(target_date), "date_to": str(target_date)},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["created_count"] == 1

    logs = client.get("/api/v1/admin/audit-logs", headers=superadmin_headers).json()["items"]
    entry = next(
        l for l in logs if l["action"] == "group.lessons_generated" and l["target_id"] == group["id"]
    )
    details = json.loads(entry["details"])
    assert details["created_count"] == 1
    assert details["skipped_count"] == 0
