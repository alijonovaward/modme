"""One-time data migration from the legacy SQLite database to PostgreSQL.

Usage (inside the backend container, where DATABASE_URL already points at
the new Postgres instance):

    SOURCE_SQLITE_PATH=/app/data/modme.db python scripts/migrate_sqlite_to_postgres.py

Reads every row from the SQLite file and writes it into the Postgres
database configured via DATABASE_URL, preserving primary keys, then fixes
up Postgres' auto-increment sequences and verifies row counts match.
"""

import os
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings  # noqa: E402
from app.db.session import Base  # noqa: E402
from app import models  # noqa: E402,F401 - registers all models on Base.metadata
from app.models.user import User  # noqa: E402
from app.models.subject import Subject  # noqa: E402
from app.models.group import Group  # noqa: E402
from app.models.group_schedule import GroupSchedule  # noqa: E402
from app.models.group_student import GroupStudent  # noqa: E402
from app.models.lesson import Lesson  # noqa: E402
from app.models.attendance import Attendance  # noqa: E402
from app.models.transaction import Transaction  # noqa: E402
from app.models.teacher_transaction import TeacherTransaction  # noqa: E402

# Parent tables before the tables that reference them via foreign keys.
MODELS_IN_FK_ORDER = [
    User,
    Subject,
    Group,
    GroupSchedule,
    GroupStudent,
    Lesson,
    Attendance,
    Transaction,
    TeacherTransaction,
]


def _copy_table(model, source_session, dest_session) -> tuple[int, int]:
    columns = [col.name for col in model.__table__.columns]
    rows = source_session.query(model).order_by(model.id).all()
    for row in rows:
        data = {name: getattr(row, name) for name in columns}
        dest_session.add(model(**data))
    dest_session.commit()

    source_count = source_session.query(model).count()
    dest_count = dest_session.query(model).count()
    return source_count, dest_count


def _reset_sequence(dest_engine, table_name: str) -> None:
    with dest_engine.begin() as conn:
        conn.execute(
            text(
                f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {table_name}), 1))"
            )
        )


def main() -> None:
    dest_url = settings.database_url
    if not dest_url.startswith("postgresql"):
        raise SystemExit(
            f"DATABASE_URL ({dest_url}) is not PostgreSQL. "
            "Point DATABASE_URL at the new Postgres instance before running this script."
        )

    source_path = os.environ.get("SOURCE_SQLITE_PATH", "/app/data/modme.db")
    if not os.path.exists(source_path):
        raise SystemExit(f"SQLite source file not found: {source_path}")
    source_url = f"sqlite:///{source_path}"

    source_engine = create_engine(source_url, connect_args={"check_same_thread": False})
    dest_engine = create_engine(dest_url)

    SourceSession = sessionmaker(bind=source_engine)
    DestSession = sessionmaker(bind=dest_engine)

    source_session = SourceSession()
    dest_session = DestSession()

    print(f"Source:      {source_url}")
    print(f"Destination: {dest_url}")

    Base.metadata.create_all(bind=dest_engine)

    existing_users = dest_session.query(User).count()
    if existing_users > 0:
        raise SystemExit(
            f"Destination Postgres database already has {existing_users} user(s). "
            "Refusing to run against a non-empty database."
        )

    all_ok = True
    for model in MODELS_IN_FK_ORDER:
        table_name = model.__tablename__
        source_count, dest_count = _copy_table(model, source_session, dest_session)
        _reset_sequence(dest_engine, table_name)
        status = "OK" if source_count == dest_count else "MISMATCH"
        if status == "MISMATCH":
            all_ok = False
        print(f"{table_name}: {source_count}/{dest_count} {status}")

    source_session.close()
    dest_session.close()

    if not all_ok:
        raise SystemExit("Migration finished with mismatched row counts - see above.")

    print("Migration completed successfully.")


if __name__ == "__main__":
    main()
