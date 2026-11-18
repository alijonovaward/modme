import json
from dataclasses import dataclass
from typing import Optional

from fastapi.encoders import jsonable_encoder
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.idempotency_key import IdempotencyKey


@dataclass
class IdempotentReplay:
    status_code: int
    body: object


def begin_idempotent_request(
    db: Session, endpoint: str, key: Optional[str]
) -> Optional[IdempotentReplay]:
    """Call this as the very first thing in a money-moving endpoint, before any other
    write. Returns None if the caller should proceed with the normal business logic
    (either no key was given, or this key is new and has been reserved). Returns an
    `IdempotentReplay` if a request with this key already finished and its response
    should be returned verbatim instead of running the logic again.

    Raises `IdempotencyInProgress` if a request with this key is still being processed
    (a near-simultaneous duplicate) - the caller should turn that into a 409 so the
    client can retry shortly instead of risking a second side effect.
    """
    if not key:
        return None

    db.add(IdempotencyKey(key=key, endpoint=endpoint))
    try:
        db.commit()
        return None
    except IntegrityError:
        db.rollback()

    existing = db.query(IdempotencyKey).filter(IdempotencyKey.key == key).first()
    if existing is not None and existing.response_body is not None:
        return IdempotentReplay(
            status_code=existing.status_code or 200,
            body=json.loads(existing.response_body),
        )
    raise IdempotencyInProgress()


class IdempotencyInProgress(Exception):
    pass


def finish_idempotent_request(db: Session, key: Optional[str], status_code: int, body: object) -> None:
    if not key:
        return
    row = db.query(IdempotencyKey).filter(IdempotencyKey.key == key).first()
    if row is None:
        return
    row.status_code = status_code
    row.response_body = json.dumps(jsonable_encoder(body))
    db.commit()


def abort_idempotent_request(db: Session, key: Optional[str]) -> None:
    """Call if the business logic raises before `finish_idempotent_request` runs, so a
    retry with the same key isn't stuck forever behind a dead reservation."""
    if not key:
        return
    db.rollback()
    row = db.query(IdempotencyKey).filter(IdempotencyKey.key == key).first()
    if row is not None and row.response_body is None:
        db.delete(row)
        db.commit()
