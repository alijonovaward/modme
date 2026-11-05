import re

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.telegram import send_contact_request, send_telegram_message
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/api/v1/telegram", tags=["telegram"])


def _normalize_phone(raw: str) -> str:
    digits = re.sub(r"[^\d]", "", raw)
    return f"+{digits}"


@router.post("/webhook")
def telegram_webhook(payload: dict, request: Request, db: Session = Depends(get_db)):
    secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
    if not settings.telegram_webhook_secret or secret != settings.telegram_webhook_secret:
        raise HTTPException(status_code=403, detail="Forbidden")

    message = payload.get("message") or {}
    chat = message.get("chat") or {}
    chat_id = str(chat.get("id") or "")
    if not chat_id:
        return {"ok": True}

    contact = message.get("contact")
    if contact and contact.get("phone_number"):
        phone = _normalize_phone(contact["phone_number"])
        user = db.query(User).filter(User.phone == phone).first()
        if user is not None:
            user.telegram_chat_id = chat_id
            db.commit()
            send_telegram_message(
                chat_id,
                "Hisobingiz ulandi! Endi balans va dars xabarlarini shu yerda olasiz.",
            )
        else:
            send_telegram_message(
                chat_id, "Bu raqam tizimda topilmadi. Administratorga murojaat qiling."
            )
        return {"ok": True}

    if message.get("text") == "/start":
        send_contact_request(
            chat_id,
            "Xush kelibsiz! Hisobingizni ulash uchun telefon raqamingizni yuboring.",
        )

    return {"ok": True}
