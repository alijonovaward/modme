import uuid

from app.models.user import User
from tests.conftest import auth_headers, login, make_staff


def _balance(db_session, user_id: int) -> float:
    db_session.expire_all()
    return db_session.get(User, user_id).balance


def test_superadmin_can_pay_an_admin_and_balance_goes_negative(
    client, superadmin_headers, admin_headers, db_session
):
    target_admin = make_staff(
        client, superadmin_headers, role="admin", phone="+998900600001"
    )

    resp = client.post(
        f"/api/v1/teachers/{target_admin['id']}/payout",
        headers=superadmin_headers,
        json={"amount": 5_000_000, "comment": "Oylik"},
    )
    assert resp.status_code == 201, resp.text
    assert _balance(db_session, target_admin["id"]) == -5_000_000.0


def test_ordinary_admin_cannot_pay_another_admin(client, superadmin_headers, admin_headers):
    target_admin = make_staff(
        client, superadmin_headers, role="admin", phone="+998900600002"
    )
    # admin_headers belongs to a *different* admin than target_admin
    resp = client.post(
        f"/api/v1/teachers/{target_admin['id']}/payout",
        headers=admin_headers,
        json={"amount": 100000},
    )
    assert resp.status_code == 403, resp.text


def test_ordinary_admin_cannot_view_another_admins_finance(
    client, superadmin_headers, admin_headers
):
    target_admin = make_staff(
        client, superadmin_headers, role="admin", phone="+998900600003"
    )
    resp = client.get(
        f"/api/v1/teachers/{target_admin['id']}/finance", headers=admin_headers
    )
    assert resp.status_code == 403, resp.text


def test_admin_payout_hidden_from_ordinary_admin_in_shared_transactions_list(
    client, superadmin_headers, admin_headers
):
    target_admin = make_staff(
        client, superadmin_headers, role="admin", phone="+998900600004"
    )
    client.post(
        f"/api/v1/teachers/{target_admin['id']}/payout",
        headers=superadmin_headers,
        json={"amount": 200000},
    )

    resp = client.get("/api/v1/teachers/transactions", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    assert all(item["teacher_id"] != target_admin["id"] for item in resp.json()["items"])

    resp = client.get("/api/v1/teachers/transactions", headers=superadmin_headers)
    assert resp.status_code == 200, resp.text
    assert any(item["teacher_id"] == target_admin["id"] for item in resp.json()["items"])


def test_reversing_a_payout_credits_the_balance_back(
    client, superadmin_headers, admin_headers, db_session
):
    teacher = make_staff(
        client, superadmin_headers, role="teacher", phone="+998900600005", teacher_percentage=40
    )
    teacher_user = db_session.get(User, teacher["id"])
    teacher_user.balance = 100000.0
    db_session.commit()

    payout_resp = client.post(
        f"/api/v1/teachers/{teacher['id']}/payout",
        headers=admin_headers,
        json={"amount": 60000},
    )
    assert payout_resp.status_code == 201, payout_resp.text
    payout_id = payout_resp.json()["id"]
    assert _balance(db_session, teacher["id"]) == 40000.0

    # An ordinary admin may not reverse it
    forbidden = client.post(
        f"/api/v1/teachers/transactions/{payout_id}/reverse", headers=admin_headers
    )
    assert forbidden.status_code == 403, forbidden.text

    reverse_resp = client.post(
        f"/api/v1/teachers/transactions/{payout_id}/reverse", headers=superadmin_headers
    )
    assert reverse_resp.status_code == 201, reverse_resp.text
    assert reverse_resp.json()["amount"] == 60000.0
    assert _balance(db_session, teacher["id"]) == 100000.0

    # Reversing the same payout twice is rejected
    again = client.post(
        f"/api/v1/teachers/transactions/{payout_id}/reverse", headers=superadmin_headers
    )
    assert again.status_code == 400, again.text


def test_duplicate_reverse_key_does_not_double_credit(
    client, superadmin_headers, admin_headers, db_session
):
    teacher = make_staff(
        client, superadmin_headers, role="teacher", phone="+998900600006", teacher_percentage=40
    )
    teacher_user = db_session.get(User, teacher["id"])
    teacher_user.balance = 50000.0
    db_session.commit()

    payout_resp = client.post(
        f"/api/v1/teachers/{teacher['id']}/payout",
        headers=admin_headers,
        json={"amount": 50000},
    )
    payout_id = payout_resp.json()["id"]
    key = str(uuid.uuid4())

    resp1 = client.post(
        f"/api/v1/teachers/transactions/{payout_id}/reverse",
        headers={**superadmin_headers, "Idempotency-Key": key},
    )
    assert resp1.status_code == 201, resp1.text

    resp2 = client.post(
        f"/api/v1/teachers/transactions/{payout_id}/reverse",
        headers={**superadmin_headers, "Idempotency-Key": key},
    )
    assert resp2.status_code == 201, resp2.text
    assert resp2.json() == resp1.json()

    assert _balance(db_session, teacher["id"]) == 50000.0
