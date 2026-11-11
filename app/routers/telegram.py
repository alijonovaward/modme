import re
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.telegram import send_contact_request, send_role_menu, send_telegram_message
from app.db.session import get_db
from app.models.group import Group
from app.models.group_student import GroupStudent
from app.models.lesson import Lesson
from app.models.transaction import Transaction
from app.models.user import User, UserRole
from app.routers.groups import _build_groups_query, _format_schedule_cell, _to_list_item
from app.routers.lessons import ATTENDANCE_STATUS_LABELS, _build_lesson_items, _build_lessons_query
from app.routers.stats import _compute_stats_overview
from app.routers.students import _build_student_transactions_query, _student_attendance_rows
from app.routers.teachers import TEACHER_TX_TYPE_LABELS, _query_teacher_finance
from app.routers.transactions import TRANSACTION_TYPE_LABELS

router = APIRouter(prefix="/api/v1/telegram", tags=["telegram"])

RECENT_LIMIT = 5


def _normalize_phone(raw: str) -> str:
    digits = re.sub(r"[^\d]", "", raw)
    return f"+{digits}"


def _handle_balance(db: Session, user: User) -> str:
    return f"💰 Joriy balansingiz: {user.balance:,.0f} so'm"


def _handle_attendance(db: Session, user: User) -> str:
    rows = _student_attendance_rows(db, user, user, None, None, None, None)[:RECENT_LIMIT]
    if not rows:
        return "Hali davomat yozuvlari yo'q."
    lines = [
        f"{lesson.lesson_date} — {group.name}: {ATTENDANCE_STATUS_LABELS[attendance.status]}"
        + (f" (baho: {attendance.grade})" if attendance.grade is not None else "")
        for attendance, lesson, group, _teacher in rows
    ]
    return "📋 So'nggi davomatlaringiz:\n\n" + "\n".join(lines)


def _handle_student_transactions(db: Session, user: User) -> str:
    rows = (
        _build_student_transactions_query(db, user, None, None, None, None)
        .order_by(Transaction.created_at.desc())
        .limit(RECENT_LIMIT)
        .all()
    )
    if not rows:
        return "Hali tranzaksiyalar yo'q."
    lines = [
        f"{t.created_at:%Y-%m-%d} — {TRANSACTION_TYPE_LABELS.get(t.type, t.type.value)}: "
        f"{t.amount:,.0f} so'm"
        for t, _lesson, _group, _teacher in rows
    ]
    return "💳 So'nggi tranzaksiyalaringiz:\n\n" + "\n".join(lines)


def _handle_student_lessons(db: Session, user: User) -> str:
    rows = (
        db.query(Lesson, Group)
        .join(Group, Group.id == Lesson.group_id)
        .join(GroupStudent, GroupStudent.group_id == Group.id)
        .filter(GroupStudent.student_id == user.id, Lesson.lesson_date >= date.today())
        .order_by(Lesson.lesson_date)
        .limit(RECENT_LIMIT)
        .all()
    )
    if not rows:
        return "Yaqin kunlarda rejalashtirilgan darslar yo'q."
    lines = []
    for lesson, group in rows:
        time_part = (
            f" {lesson.start_time.strftime('%H:%M')}-{lesson.end_time.strftime('%H:%M')}"
            if lesson.start_time and lesson.end_time
            else ""
        )
        lines.append(f"{lesson.lesson_date}{time_part} — {group.name}")
    return "📅 Yaqin darslaringiz:\n\n" + "\n".join(lines)


def _handle_teacher_finance(db: Session, user: User) -> str:
    items = _query_teacher_finance(db, user.id, None, None, None)
    if not items:
        return "Hali moliyaviy yozuvlar yo'q."
    lines = [
        f"{item.created_at:%Y-%m-%d} — {TEACHER_TX_TYPE_LABELS.get(item.type, item.type.value)}: "
        f"{item.amount:,.0f} so'm"
        for item in items[:RECENT_LIMIT]
    ]
    return f"💰 Joriy balans: {user.balance:,.0f} so'm\n\nSo'nggi harakatlar:\n\n" + "\n".join(lines)


def _handle_teacher_groups(db: Session, user: User) -> str:
    groups = _build_groups_query(db, user, None).all()
    if not groups:
        return "Sizga biriktirilgan guruhlar yo'q."
    lines = []
    for group in groups:
        item = _to_list_item(group, db)
        lines.append(f"{item.name} ({item.subject_name}) — {_format_schedule_cell(item.schedule)}")
    return "👥 Guruhlaringiz:\n\n" + "\n".join(lines)


def _handle_teacher_lessons(db: Session, user: User) -> str:
    query = _build_lessons_query(db, user, None, None, date.today(), None, None)
    rows = query.order_by(Lesson.lesson_date).limit(RECENT_LIMIT).all()
    items = _build_lesson_items(db, rows)
    if not items:
        return "Yaqin kunlarda rejalashtirilgan darslar yo'q."
    lines = []
    for item in items:
        time_part = (
            f" {item.start_time.strftime('%H:%M')}-{item.end_time.strftime('%H:%M')}"
            if item.start_time and item.end_time
            else ""
        )
        lines.append(f"{item.lesson_date}{time_part} — {item.group_name}")
    return "📅 Yaqin darslaringiz:\n\n" + "\n".join(lines)


def _handle_debtor_count(db: Session, user: User) -> str:
    count = db.query(User).filter(User.role == UserRole.student, User.balance < 0).count()
    return f"⚠️ Qarzdor o'quvchilar soni: {count} ta"


def _handle_stats(db: Session, user: User) -> str:
    stats = _compute_stats_overview(db)
    return (
        "📊 Umumiy statistika:\n\n"
        f"Jami to'ldirilgan: {stats.total_deposits:,.0f} so'm\n"
        f"Jami yechilgan: {stats.total_deductions:,.0f} so'm\n"
        f"O'qituvchilar daromadi: {stats.total_teacher_earnings:,.0f} so'm\n"
        f"O'qituvchilarga to'langan: {stats.total_teacher_payouts:,.0f} so'm\n"
        f"O'quvchilar umumiy balansi: {stats.total_student_balance:,.0f} so'm\n"
        f"Markaz sof daromadi: {stats.total_center_revenue:,.0f} so'm"
    )


ROLE_HANDLERS: dict[UserRole, dict[str, callable]] = {
    UserRole.student: {
        "💰 Balansim": _handle_balance,
        "📋 Davomatim": _handle_attendance,
        "💳 Tranzaksiyalarim": _handle_student_transactions,
        "📅 Darslarim": _handle_student_lessons,
    },
    UserRole.teacher: {
        "💰 Moliyam": _handle_teacher_finance,
        "👥 Guruhlarim": _handle_teacher_groups,
        "📅 Darslarim": _handle_teacher_lessons,
    },
    UserRole.admin: {
        "⚠️ Qarzdorlar soni": _handle_debtor_count,
    },
    UserRole.superadmin: {
        "⚠️ Qarzdorlar soni": _handle_debtor_count,
        "📊 Statistika": _handle_stats,
    },
}


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
            send_role_menu(
                chat_id,
                user.role,
                "Hisobingiz ulandi! Endi balans va dars xabarlarini shu yerda olasiz. "
                "Quyidagi tugmalar orqali ma'lumotlaringizni ko'rishingiz mumkin.",
            )
        else:
            send_telegram_message(
                chat_id, "Bu raqam tizimda topilmadi. Administratorga murojaat qiling."
            )
        return {"ok": True}

    text = message.get("text")
    linked_user = db.query(User).filter(User.telegram_chat_id == chat_id).first()

    if text == "/start":
        if linked_user is not None:
            send_role_menu(chat_id, linked_user.role, "Xush kelibsiz! Nimani ko'rishni xohlaysiz?")
        else:
            send_contact_request(
                chat_id,
                "Xush kelibsiz! Hisobingizni ulash uchun telefon raqamingizni yuboring.",
            )
        return {"ok": True}

    if linked_user is None:
        send_telegram_message(chat_id, "Avval /start bosing va hisobingizni ulang.")
        return {"ok": True}

    handler = ROLE_HANDLERS.get(linked_user.role, {}).get(text)
    if handler is not None:
        send_telegram_message(chat_id, handler(db, linked_user))
    else:
        send_role_menu(chat_id, linked_user.role, "Quyidagi tugmalardan birini tanlang:")

    return {"ok": True}
