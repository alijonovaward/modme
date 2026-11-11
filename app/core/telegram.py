import httpx

from app.core.config import settings
from app.models.user import UserRole

TELEGRAM_API_BASE = "https://api.telegram.org"

ROLE_MENUS: dict[UserRole, list[list[str]]] = {
    UserRole.student: [
        ["💰 Balansim", "📋 Davomatim"],
        ["💳 Tranzaksiyalarim", "📅 Darslarim"],
    ],
    UserRole.teacher: [
        ["💰 Moliyam", "👥 Guruhlarim"],
        ["📅 Darslarim"],
    ],
    UserRole.admin: [
        ["⚠️ Qarzdorlar soni"],
    ],
    UserRole.superadmin: [
        ["⚠️ Qarzdorlar soni", "📊 Statistika"],
    ],
}


def send_telegram_message(chat_id: str, text: str) -> None:
    """Best-effort notification send. Must never raise - a down/misconfigured
    Telegram integration should not break the request that triggered it."""
    if not settings.telegram_bot_token or not chat_id:
        return
    url = f"{TELEGRAM_API_BASE}/bot{settings.telegram_bot_token}/sendMessage"
    try:
        httpx.post(url, json={"chat_id": chat_id, "text": text}, timeout=5.0)
    except httpx.HTTPError:
        pass


def send_reply_keyboard(chat_id: str, text: str, rows: list[list[str]]) -> None:
    if not settings.telegram_bot_token or not chat_id:
        return
    url = f"{TELEGRAM_API_BASE}/bot{settings.telegram_bot_token}/sendMessage"
    keyboard = {
        "keyboard": [[{"text": label} for label in row] for row in rows],
        "resize_keyboard": True,
    }
    try:
        httpx.post(
            url,
            json={"chat_id": chat_id, "text": text, "reply_markup": keyboard},
            timeout=5.0,
        )
    except httpx.HTTPError:
        pass


def send_role_menu(chat_id: str, role: UserRole, text: str) -> None:
    send_reply_keyboard(chat_id, text, ROLE_MENUS.get(role, []))


def send_contact_request(chat_id: str, text: str) -> None:
    if not settings.telegram_bot_token or not chat_id:
        return
    url = f"{TELEGRAM_API_BASE}/bot{settings.telegram_bot_token}/sendMessage"
    keyboard = {
        "keyboard": [[{"text": "📱 Telefon raqamni ulashish", "request_contact": True}]],
        "resize_keyboard": True,
        "one_time_keyboard": True,
    }
    try:
        httpx.post(
            url,
            json={"chat_id": chat_id, "text": text, "reply_markup": keyboard},
            timeout=5.0,
        )
    except httpx.HTTPError:
        pass
