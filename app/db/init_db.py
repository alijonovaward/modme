from sqlalchemy import inspect, text

from app.db.session import Base, SessionLocal, engine, is_sqlite
from app import models  # noqa: F401 - ensures all models are registered on Base.metadata
from app.models.user import User, UserRole
from app.core.security import hash_password


REQUIRED_COLUMNS = {
    "pending_charges": {
        "original_amount": "NUMERIC(14, 0)",
    },
    "transactions": {
        "created_by_id": "INTEGER",
        "lesson_id": "INTEGER",
    },
    "teacher_transactions": {
        "comment": "VARCHAR",
        "student_id": "INTEGER",
        "created_by_id": "INTEGER",
        "reversed_at": "TIMESTAMP",
    },
    "group_students": {
        "status_reason": "VARCHAR",
    },
    "attendances": {
        "created_at": "TIMESTAMP",
        "correct_count": "INTEGER",
        "total_count": "INTEGER",
        "is_trial": "BOOLEAN",
    },
    "users": {
        "is_active": "BOOLEAN",
        "telegram_chat_id": "VARCHAR",
    },
    "lessons": {
        "start_time": "TIME",
        "end_time": "TIME",
    },
}

# Money columns that used to be FLOAT and must become exact fixed-point NUMERIC, so
# backend arithmetic can no longer drift due to binary floating-point rounding. Only
# matters on Postgres (prod): SQLite has no real column type enforcement, so the new
# `Numeric` model type already applies there without an ALTER. The `USING ROUND(...)`
# clause rounds any pre-existing fractional so'm (left over from the old float math)
# down to a whole so'm, consistent with the app's "no subunit" rounding policy.
NUMERIC_MONEY_COLUMNS = {
    "users": ["balance"],
    "transactions": ["amount"],
    "teacher_transactions": ["amount"],
    "pending_charges": ["amount", "original_amount", "teacher_share"],
    "groups": ["lesson_price"],
}


def _migrate_money_columns_to_numeric() -> None:
    if is_sqlite:
        return

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table_name, column_names in NUMERIC_MONEY_COLUMNS.items():
        if table_name not in existing_tables:
            continue
        existing_columns = {col["name"]: col for col in inspector.get_columns(table_name)}
        for column_name in column_names:
            col_info = existing_columns.get(column_name)
            if col_info is None:
                continue
            if str(col_info["type"]).upper().startswith("NUMERIC"):
                continue
            with engine.begin() as conn:
                conn.execute(
                    text(
                        f"ALTER TABLE {table_name} ALTER COLUMN {column_name} "
                        f"TYPE NUMERIC(14, 0) USING ROUND({column_name}::numeric)"
                    )
                )


def _ensure_lesson_unique_index() -> None:
    """Guards against a group ever having two lesson rows for the same calendar day
    (the double-click / slow-network duplicate-lesson bug). `Base.metadata.create_all`
    only creates brand-new tables, so an existing `lessons` table needs this added by
    hand. If duplicate (group_id, lesson_date) rows already exist from before this
    fix, creating the index would fail outright - so this skips (and logs) instead of
    crashing app startup; an operator can clean up those rows and the index will be
    created automatically on the next restart.
    """
    inspector = inspect(engine)
    if "lessons" not in inspector.get_table_names():
        return

    already_unique = any(
        set(idx["column_names"]) == {"group_id", "lesson_date"} and idx.get("unique")
        for idx in inspector.get_indexes("lessons")
    )
    if already_unique:
        return

    with engine.connect() as conn:
        duplicate_count = conn.execute(
            text(
                "SELECT COUNT(*) FROM ("
                "SELECT group_id, lesson_date FROM lessons "
                "GROUP BY group_id, lesson_date HAVING COUNT(*) > 1"
                ") AS dupes"
            )
        ).scalar()

    if duplicate_count:
        print(
            f"[init_db] OGOHLANTIRISH: {duplicate_count} ta guruh+sana uchun takroriy "
            "dars (lessons) qatori topildi - ularni qo'lda tozalamaguningizcha "
            "unique indeks o'rnatilmaydi."
        )
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_lessons_group_date "
                "ON lessons (group_id, lesson_date)"
            )
        )


def _ensure_group_student_unique_index() -> None:
    """Same idea as `_ensure_lesson_unique_index`, for group enrollment: a student
    should only ever have one non-dropped `group_students` row per group. Partial
    (WHERE-filtered) so a dropped-then-re-enrolled student is still allowed."""
    inspector = inspect(engine)
    if "group_students" not in inspector.get_table_names():
        return

    already_unique = any(
        idx.get("name") == "uq_group_students_active"
        for idx in inspector.get_indexes("group_students")
    )
    if already_unique:
        return

    with engine.connect() as conn:
        duplicate_count = conn.execute(
            text(
                "SELECT COUNT(*) FROM ("
                "SELECT group_id, student_id FROM group_students "
                "WHERE status != 'dropped' "
                "GROUP BY group_id, student_id HAVING COUNT(*) > 1"
                ") AS dupes"
            )
        ).scalar()

    if duplicate_count:
        print(
            f"[init_db] OGOHLANTIRISH: {duplicate_count} ta guruh+o'quvchi uchun "
            "takroriy faol a'zolik topildi - ularni qo'lda tozalamaguningizcha "
            "unique indeks o'rnatilmaydi."
        )
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_group_students_active "
                "ON group_students (group_id, student_id) WHERE status != 'dropped'"
            )
        )


REQUIRED_INDEXES = {
    "groups": ["subject_id", "teacher_id"],
    "group_students": ["group_id", "student_id"],
    "lessons": ["group_id"],
    "attendances": ["lesson_id", "student_id"],
    "transactions": ["student_id", "lesson_id"],
    "teacher_transactions": ["teacher_id", "lesson_id", "student_id"],
    "users": ["telegram_chat_id"],
}


def _run_migrations() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table_name, required_columns in REQUIRED_COLUMNS.items():
        if table_name not in existing_tables:
            continue
        existing_columns = {col["name"] for col in inspector.get_columns(table_name)}
        for column_name, column_type in required_columns.items():
            if column_name not in existing_columns:
                with engine.begin() as conn:
                    conn.execute(
                        text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
                    )

    if "users" in existing_tables:
        with engine.begin() as conn:
            conn.execute(text("UPDATE users SET is_active = TRUE WHERE is_active IS NULL"))

    if "attendances" in existing_tables:
        with engine.begin() as conn:
            conn.execute(text("UPDATE attendances SET is_trial = FALSE WHERE is_trial IS NULL"))

    for table_name, columns in REQUIRED_INDEXES.items():
        if table_name not in existing_tables:
            continue
        existing_indexed_columns = {
            col
            for idx in inspector.get_indexes(table_name)
            for col in idx["column_names"]
        }
        for column_name in columns:
            if column_name in existing_indexed_columns:
                continue
            index_name = f"ix_{table_name}_{column_name}"
            with engine.begin() as conn:
                conn.execute(
                    text(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({column_name})")
                )


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    _migrate_money_columns_to_numeric()
    _ensure_lesson_unique_index()
    _ensure_group_student_unique_index()

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.role == UserRole.superadmin).first()
        if existing is None:
            superadmin = User(
                full_name="Bosh Administrator",
                phone="+998900000000",
                hashed_password=hash_password("admin123"),
                role=UserRole.superadmin,
            )
            db.add(superadmin)
            db.commit()
            print("Superadmin yaratildi: +998900000000 / admin123")
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
