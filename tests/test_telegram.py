from unittest.mock import patch

from app.core.config import settings
from app.models.user import User
from tests.conftest import make_group, make_staff, make_student, make_subject

WEBHOOK_URL = "/api/v1/telegram/webhook"


def _set_webhook_secret(monkeypatch, value: str = "test-secret"):
    monkeypatch.setattr(settings, "telegram_webhook_secret", value)
    return value


def test_webhook_rejects_missing_or_wrong_secret(client, monkeypatch):
    _set_webhook_secret(monkeypatch)
    resp = client.post(WEBHOOK_URL, json={})
    assert resp.status_code == 403

    resp = client.post(WEBHOOK_URL, json={}, headers={"X-Telegram-Bot-Api-Secret-Token": "wrong"})
    assert resp.status_code == 403


def test_webhook_start_sends_contact_request(client, monkeypatch):
    secret = _set_webhook_secret(monkeypatch)
    with patch("app.routers.telegram.send_contact_request") as mock_send:
        resp = client.post(
            WEBHOOK_URL,
            json={"message": {"chat": {"id": 555}, "text": "/start"}},
            headers={"X-Telegram-Bot-Api-Secret-Token": secret},
        )
    assert resp.status_code == 200
    mock_send.assert_called_once()
    assert mock_send.call_args[0][0] == "555"


def test_webhook_contact_links_known_phone(client, admin_headers, monkeypatch, db_session):
    secret = _set_webhook_secret(monkeypatch)
    student = make_student(client, admin_headers, phone="+998900600001")

    with patch("app.routers.telegram.send_telegram_message") as mock_send:
        resp = client.post(
            WEBHOOK_URL,
            json={
                "message": {
                    "chat": {"id": 777},
                    "contact": {"phone_number": "998900600001"},
                }
            },
            headers={"X-Telegram-Bot-Api-Secret-Token": secret},
        )
    assert resp.status_code == 200
    mock_send.assert_called_once()
    assert mock_send.call_args[0][0] == "777"

    db_session.expire_all()
    updated = db_session.query(User).filter(User.id == student["id"]).first()
    assert updated.telegram_chat_id == "777"


def test_webhook_contact_unknown_phone(client, monkeypatch):
    secret = _set_webhook_secret(monkeypatch)
    with patch("app.routers.telegram.send_telegram_message") as mock_send:
        resp = client.post(
            WEBHOOK_URL,
            json={
                "message": {
                    "chat": {"id": 888},
                    "contact": {"phone_number": "+998900600099"},
                }
            },
            headers={"X-Telegram-Bot-Api-Secret-Token": secret},
        )
    assert resp.status_code == 200
    mock_send.assert_called_once()
    assert "topilmadi" in mock_send.call_args[0][1]


def test_deposit_notifies_linked_student(client, admin_headers, db_session):
    student = make_student(client, admin_headers, phone="+998900600002")
    db_user = db_session.query(User).filter(User.id == student["id"]).first()
    db_user.telegram_chat_id = "999"
    db_session.commit()

    with patch("app.routers.students.send_telegram_message") as mock_send:
        resp = client.post(
            f"/api/v1/students/{student['id']}/deposit",
            headers=admin_headers,
            json={"amount": 50000, "comment": "test"},
        )
    assert resp.status_code == 201, resp.text
    mock_send.assert_called_once()
    assert mock_send.call_args[0][0] == "999"
    assert "50,000" in mock_send.call_args[0][1] or "50000" in mock_send.call_args[0][1]


def test_payout_notifies_linked_teacher(client, superadmin_headers, admin_headers, db_session):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900600003")
    db_teacher = db_session.query(User).filter(User.id == teacher["id"]).first()
    db_teacher.telegram_chat_id = "1010"
    db_teacher.balance = 100000
    db_session.commit()

    with patch("app.routers.teachers.send_telegram_message") as mock_send:
        resp = client.post(
            f"/api/v1/teachers/{teacher['id']}/payout",
            headers=admin_headers,
            json={"amount": 30000, "comment": "oylik"},
        )
    assert resp.status_code == 201, resp.text
    mock_send.assert_called_once()
    assert mock_send.call_args[0][0] == "1010"


def test_mark_attendance_notifies_linked_student(client, superadmin_headers, admin_headers, db_session):
    teacher = make_staff(client, superadmin_headers, role="teacher", phone="+998900600004")
    teacher_login = client.post(
        "/api/v1/auth/login", data={"username": teacher["phone"], "password": "pass123"}
    )
    teacher_headers = {"Authorization": f"Bearer {teacher_login.json()['access_token']}"}

    subject = make_subject(client, admin_headers, "Bio")
    group = make_group(client, admin_headers, subject_id=subject["id"], teacher_id=teacher["id"])
    student = make_student(client, admin_headers, phone="+998900600005")
    client.post(
        f"/api/v1/groups/{group['id']}/students",
        headers=admin_headers,
        json={"student_id": student["id"]},
    )
    db_student = db_session.query(User).filter(User.id == student["id"]).first()
    db_student.telegram_chat_id = "2020"
    db_session.commit()

    lesson_resp = client.post(
        "/api/v1/lessons",
        headers=admin_headers,
        json={"group_id": group["id"], "lesson_date": "2026-11-05"},
    )
    lesson_id = lesson_resp.json()["id"]

    with patch("app.routers.lessons.send_telegram_message") as mock_send:
        resp = client.post(
            f"/api/v1/lessons/{lesson_id}/attendance",
            headers=teacher_headers,
            json={"records": [{"student_id": student["id"], "status": "present", "grade": 5}]},
        )
    assert resp.status_code == 201, resp.text
    mock_send.assert_called_once()
    assert mock_send.call_args[0][0] == "2020"
    assert "keldi" in mock_send.call_args[0][1]
