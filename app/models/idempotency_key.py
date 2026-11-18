from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.db.session import Base


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, nullable=False, unique=True, index=True)
    endpoint = Column(String, nullable=False)
    status_code = Column(Integer, nullable=True)
    response_body = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
