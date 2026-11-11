from unittest.mock import patch

from app.core.config import settings
from app.core.telegram import ROLE_MENUS
from app.models.user import User, UserRole
from tests.conftest import make_group, make_staff, make_student, make_subject

WEBHOOK_URL = "/api/v1/telegram/webhook"


def _set_webhook_secret(monkeypatch, value: str = "test-secret"):
    monkeypatch.setattr(settings, "telegram_webhook_secret", value)
    return value


def _send_text(client, secret, chat_id, text):
    return client.post(
        WEBHOOK_URL,
        json={"message": {"chat": {"id": chat_id}, "text": text}},
        headers={"X-Telegram-Bot-Api-Secret-Token": secret},
    )


def _flat_menu(role: UserRole) -> list[str]:
    return [label for row in ROLE_MENUS[role] for label in row]


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

    with patch("app.routers.telegram.send_role_menu") as mock_send:
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


def test_admin_menu_has_no_stats_button_but_superadmin_does():
    assert "📊 Statistika" not in _flat_menu(UserRole.admin)
    assert "⚠️ Qarzdorlar soni" in _flat_menu(UserRole.admin)
    assert "📊 Statistika" in _flat_menu(UserRole.superadmin)


def test_start_from_already_linked_chat_resends_menu(client, admin_headers, monkeypatch, db_session):
    secret = _set_webhook_secret(monkeypatch)
    student = make_student(client, admin_headers, phone="+998900600010")
    db_user = db_session.query(User).filter(User.id == student["id"]).first()
    db_user.telegram_chat_id = "3030"
    db_session.commit()

    with patch("app.routers.telegram.send_role_menu") as mock_send:
        resp = _send_text(client, secret, 3030, "/start")
    assert resp.status_code == 200
    mock_send.assert_called_once()
    assert mock_send.call_args[0][0] == "3030"
    assert mock_send.call_args[0][1] == UserRole.student


def test_unlinked_chat_is_prompted_to_start(client, monkeypatch):
    secret = _set_webhook_secret(monkeypatch)
    with patch("app.routers.telegram.send_telegram_message") as mock_send:
        resp = _send_text(client, secret, 4040, "salom")
    assert resp.status_code == 200
    mock_send.assert_called_once()
    assert "/start" in mock_send.call_args[0][1]


def test_student_balance_button(client, admin_headers, monkeypatch, db_session):
    secret = _set_webhook_secret(monkeypatch)
    student = make_student(client, admin_headers, phone="+998900600011")
    db_user = db_session.query(User).filter(User.id == student["id"]).first()
    db_user.telegram_chat_id = "5050"
    db_user.balance = 75000
    db_session.commit()

    with patch("app.routers.telegram.send_telegram_message") as mock_send:
        resp = _send_text(client, secret, 5050, "💰 Balansim")
    assert resp.status_code == 200
    mock_send.assert_called_once()
    assert "75,000" in mock_send.call_args[0][1]


def test_linked_student_unknown_text_resends_menu(client, admin_headers, monkeypatch, db_session):
    secret = _set_webhook_secret(monkeypatch)
    student = make_student(client, admin_headers, phone="+998900600012")
    db_user = db_session.query(User).filter(User.id == student["id"]).first()
    db_user.telegram_chat_id = "6060"
    db_session.commit()

    with patch("app.routers.telegram.send_role_menu") as mock_send:
        resp = _send_text(client, secret, 6060, "nimadir boshqa matn")
    assert resp.status_code == 200
    mock_send.assert_called_once()
    assert mock_send.call_args[0][0] == "6060"


def test_teacher_groups_button_only_shows_own_groups(
    client, superadmin_headers, admin_headers, monkeypatch, db_session
):
    secret = _set_webhook_secret(monkeypatch)
    subject = make_subject(client, admin_headers, "Chemistry")

    teacher_a = make_staff(client, superadmin_headers, role="teacher", phone="+998900600013")
    teacher_b = make_staff(client, superadmin_headers, role="teacher", phone="+998900600014")
    make_group(client, admin_headers, name="Guruh-A", subject_id=subject["id"], teacher_id=teacher_a["id"])
    make_group(client, admin_headers, name="Guruh-B", subject_id=subject["id"], teacher_id=teacher_b["id"])

    db_teacher_a = db_session.query(User).filter(User.id == teacher_a["id"]).first()
    db_teacher_a.telegram_chat_id = "7070"
    db_session.commit()

    with patch("app.routers.telegram.send_telegram_message") as mock_send:
        resp = _send_text(client, secret, 7070, "👥 Guruhlarim")
    assert resp.status_code == 200
    mock_send.assert_called_once()
    text = mock_send.call_args[0][1]
    assert "Guruh-A" in text
    assert "Guruh-B" not in text


def test_debtor_count_button_for_admin(client, admin_headers, monkeypatch, db_session):
    secret = _set_webhook_secret(monkeypatch)
    admin_user = db_session.query(User).filter(User.role == UserRole.admin).first()
    admin_user.telegram_chat_id = "8080"
    db_session.commit()

    student = make_student(client, admin_headers, phone="+998900600015")
    db_student = db_session.query(User).filter(User.id == student["id"]).first()
    db_student.balance = -5000
    db_session.commit()

    with patch("app.routers.telegram.send_telegram_message") as mock_send:
        resp = _send_text(client, secret, 8080, "⚠️ Qarzdorlar soni")
    assert resp.status_code == 200
    mock_send.assert_called_once()
    assert "1 ta" in mock_send.call_args[0][1]
