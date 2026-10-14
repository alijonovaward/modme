from sqlalchemy import inspect, text

from app.db.session import Base, SessionLocal, engine
from app import models  # noqa: F401 - ensures all models are registered on Base.metadata
from app.models.user import User, UserRole
from app.core.security import hash_password


REQUIRED_COLUMNS = {
    "transactions": {
        "created_by_id": "INTEGER",
        "lesson_id": "INTEGER",
    },
    "teacher_transactions": {
        "comment": "VARCHAR",
        "student_id": "INTEGER",
    },
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


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _run_migrations()

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
