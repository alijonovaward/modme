from sqlalchemy import Column, String

from app.db.session import Base


class AppState(Base):
    __tablename__ = "app_state"

    key = Column(String, primary_key=True)
    value = Column(String, nullable=True)
