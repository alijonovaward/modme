from app.db.session import Base, SessionLocal, engine
from app import models  # noqa: F401 - ensures all models are registered on Base.metadata
from app.models.user import User, UserRole
from app.core.security import hash_password


def init_db() -> None:
    Base.metadata.create_all(bind=engine)

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
