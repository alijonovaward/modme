import uuid

from app.models.user import User
from tests.conftest import make_staff, make_student


def _balance(db_session, user_id: int) -> float:
    db_session.expire_all()
    return db_session.get(User, user_id).balance


def test_duplicate_deposit_key_returns_same_result_without_double_crediting(
    client, admin_headers, db_session
):
    student = make_student(client, admin_headers, phone="+998900900001")
    key = str(uuid.uuid4())

    resp1 = client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers={**admin_headers, "Idempotency-Key": key},
        json={"amount": 10000},
    )
    assert resp1.status_code == 201, resp1.text

    resp2 = client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers={**admin_headers, "Idempotency-Key": key},
        json={"amount": 10000},
    )
    assert resp2.status_code == 201, resp2.text
    assert resp2.json() == resp1.json()

    # Balance credited only once, not twice
    assert _balance(db_session, student["id"]) == 10000.0


def test_different_deposit_keys_both_apply(client, admin_headers, db_session):
    student = make_student(client, admin_headers, phone="+998900900002")

    resp1 = client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers={**admin_headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"amount": 10000},
    )
    assert resp1.status_code == 201, resp1.text

    resp2 = client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers={**admin_headers, "Idempotency-Key": str(uuid.uuid4())},
        json={"amount": 10000},
    )
    assert resp2.status_code == 201, resp2.text

    assert _balance(db_session, student["id"]) == 20000.0


def test_deposit_without_idempotency_key_behaves_as_before(client, admin_headers, db_session):
    student = make_student(client, admin_headers, phone="+998900900003")

    resp = client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers=admin_headers,
        json={"amount": 5000},
    )
    assert resp.status_code == 201, resp.text
    assert _balance(db_session, student["id"]) == 5000.0


def test_duplicate_payout_key_does_not_double_debit(
    client, superadmin_headers, admin_headers, db_session
):
    teacher = make_staff(
        client, superadmin_headers, role="teacher", phone="+998900900004", teacher_percentage=40
    )
    teacher_user = db_session.get(User, teacher["id"])
    teacher_user.balance = 50000.0
    db_session.commit()

    key = str(uuid.uuid4())
    resp1 = client.post(
        f"/api/v1/teachers/{teacher['id']}/payout",
        headers={**admin_headers, "Idempotency-Key": key},
        json={"amount": 20000},
    )
    assert resp1.status_code == 201, resp1.text

    resp2 = client.post(
        f"/api/v1/teachers/{teacher['id']}/payout",
        headers={**admin_headers, "Idempotency-Key": key},
        json={"amount": 20000},
    )
    assert resp2.status_code == 201, resp2.text
    assert resp2.json() == resp1.json()

    assert _balance(db_session, teacher["id"]) == 30000.0


def test_failed_request_releases_idempotency_key_for_retry(client, admin_headers, db_session):
    student = make_student(client, admin_headers, phone="+998900900005")
    key = str(uuid.uuid4())

    bad_resp = client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers={**admin_headers, "Idempotency-Key": key},
        json={"amount": -100},
    )
    assert bad_resp.status_code == 400, bad_resp.text

    good_resp = client.post(
        f"/api/v1/students/{student['id']}/deposit",
        headers={**admin_headers, "Idempotency-Key": key},
        json={"amount": 15000},
    )
    assert good_resp.status_code == 201, good_resp.text
    assert _balance(db_session, student["id"]) == 15000.0
