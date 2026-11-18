from app.models.user import User
from tests.conftest import add_student_to_group, make_group, make_staff, make_student, make_subject


def test_reconciliation_report_has_no_mismatches_after_normal_activity(
    client, superadmin_headers, admin_headers, db_session
):
    teacher = make_staff(
        client, superadmin_headers, role="teacher", phone="+998900950001", teacher_percentage=40
    )
    subject = make_subject(client, admin_headers, "Reconciliation-Subject")
    group = make_group(
        client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"], lesson_price=50000
    )
    student = make_student(client, admin_headers, phone="+998900950002")
    client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers=admin_headers,
        json={"amount": 30000},
    )
    add_student_to_group(client, admin_headers, group_id=group["id"], student_id=student["id"])

    resp = client.get("/api/v1/stats/reconciliation", headers=superadmin_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["mismatches"] == []
    assert body["checked_students"] >= 1
    assert body["checked_teachers"] >= 1


def test_reconciliation_report_catches_a_tampered_balance(
    client, superadmin_headers, admin_headers, db_session
):
    student = make_student(client, admin_headers, phone="+998900950003")
    client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers=admin_headers,
        json={"amount": 10000},
    )

    # Simulate drift: something outside the normal flow changed the stored balance
    # without a matching Transaction row.
    db_user = db_session.get(User, student["id"])
    db_user.balance = 999999
    db_session.commit()

    resp = client.get("/api/v1/stats/reconciliation", headers=superadmin_headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    mismatch = next(m for m in body["mismatches"] if m["user_id"] == student["id"])
    assert mismatch["stored_balance"] == 999999.0
    assert mismatch["computed_balance"] == 10000.0
    assert mismatch["difference"] == 989999.0


def test_reconciliation_report_requires_superadmin(client, admin_headers):
    resp = client.get("/api/v1/stats/reconciliation", headers=admin_headers)
    assert resp.status_code == 403
