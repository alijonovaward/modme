import uuid

from app.models.user import User
from tests.conftest import auth_headers, login, make_staff, make_student


def _balance(db_session, user_id: int) -> float:
    db_session.expire_all()
    return db_session.get(User, user_id).balance


def test_withdraw_reduces_balance_and_records_a_deduction(client, admin_headers, db_session):
    student = make_student(client, admin_headers, phone="+998900950101")
    client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers=admin_headers,
        json={"amount": 100000},
    )

    resp = client.post(
        f"/api/v1/students/{student['id']}/withdraw",
        headers=admin_headers,
        json={"amount": 30000, "comment": "Ortiqcha to'lov qaytarildi"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["type"] == "deduction"
    assert body["amount"] == -30000.0

    assert _balance(db_session, student["id"]) == 70000.0


def test_cannot_withdraw_more_than_current_balance(client, admin_headers, db_session):
    student = make_student(client, admin_headers, phone="+998900950102")
    client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers=admin_headers,
        json={"amount": 20000},
    )

    resp = client.post(
        f"/api/v1/students/{student['id']}/withdraw",
        headers=admin_headers,
        json={"amount": 20001},
    )
    assert resp.status_code == 400, resp.text
    assert _balance(db_session, student["id"]) == 20000.0


def test_withdraw_rejects_non_positive_amount(client, admin_headers):
    student = make_student(client, admin_headers, phone="+998900950103")

    resp = client.post(
        f"/api/v1/students/{student['id']}/withdraw",
        headers=admin_headers,
        json={"amount": 0},
    )
    assert resp.status_code == 400, resp.text


def test_teacher_cannot_withdraw_from_a_student(client, superadmin_headers, admin_headers):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900950104")
    teacher_headers = auth_headers(login(client, teacher["phone"], "pass123"))
    student = make_student(client, admin_headers, phone="+998900950105")

    resp = client.post(
        f"/api/v1/students/{student['id']}/withdraw",
        headers=teacher_headers,
        json={"amount": 1000},
    )
    assert resp.status_code == 403, resp.text


def test_duplicate_withdraw_key_does_not_double_debit(client, admin_headers, db_session):
    student = make_student(client, admin_headers, phone="+998900950106")
    client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers=admin_headers,
        json={"amount": 50000},
    )
    key = str(uuid.uuid4())

    resp1 = client.post(
        f"/api/v1/students/{student['id']}/withdraw",
        headers={**admin_headers, "Idempotency-Key": key},
        json={"amount": 20000},
    )
    assert resp1.status_code == 201, resp1.text

    resp2 = client.post(
        f"/api/v1/students/{student['id']}/withdraw",
        headers={**admin_headers, "Idempotency-Key": key},
        json={"amount": 20000},
    )
    assert resp2.status_code == 201, resp2.text
    assert resp2.json() == resp1.json()

    assert _balance(db_session, student["id"]) == 30000.0


def test_reconciliation_stays_clean_after_a_withdrawal(client, admin_headers, superadmin_headers, db_session):
    student = make_student(client, admin_headers, phone="+998900950107")
    client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers=admin_headers,
        json={"amount": 40000},
    )
    client.post(
        f"/api/v1/students/{student['id']}/withdraw",
        headers=admin_headers,
        json={"amount": 15000},
    )

    resp = client.get("/api/v1/stats/reconciliation", headers=superadmin_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["mismatches"] == []
