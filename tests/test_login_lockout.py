from datetime import datetime, timedelta, timezone

from app.models.user import User
from tests.conftest import make_student


def test_five_wrong_passwords_lock_the_account_even_with_the_right_password_after(
    client, admin_headers
):
    student = make_student(client, admin_headers, phone="+998900900001")

    for _ in range(5):
        resp = client.post(
            "/api/v1/auth/login",
            data={"username": student["phone"], "password": "wrong"},
        )
        assert resp.status_code == 401, resp.text

    resp = client.post(
        "/api/v1/auth/login",
        data={"username": student["phone"], "password": "pass123"},
    )
    assert resp.status_code == 403, resp.text
    assert "daqiqadan" in resp.json()["detail"]


def test_a_successful_login_resets_the_failed_attempt_counter(client, admin_headers, db_session):
    student = make_student(client, admin_headers, phone="+998900900002")

    for _ in range(3):
        resp = client.post(
            "/api/v1/auth/login",
            data={"username": student["phone"], "password": "wrong"},
        )
        assert resp.status_code == 401, resp.text

    resp = client.post(
        "/api/v1/auth/login",
        data={"username": student["phone"], "password": "pass123"},
    )
    assert resp.status_code == 200, resp.text

    db_session.expire_all()
    refreshed = db_session.get(User, student["id"])
    assert refreshed.failed_login_attempts == 0
    assert refreshed.locked_until is None


def test_lockout_expires_after_its_window(client, admin_headers, db_session):
    student = make_student(client, admin_headers, phone="+998900900003")

    for _ in range(5):
        client.post(
            "/api/v1/auth/login",
            data={"username": student["phone"], "password": "wrong"},
        )

    resp = client.post(
        "/api/v1/auth/login",
        data={"username": student["phone"], "password": "pass123"},
    )
    assert resp.status_code == 403, resp.text

    user = db_session.get(User, student["id"])
    user.locked_until = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()

    resp = client.post(
        "/api/v1/auth/login",
        data={"username": student["phone"], "password": "pass123"},
    )
    assert resp.status_code == 200, resp.text
