from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User

ZERO = Decimal("0")


def round_som(value) -> Decimal:
    """Rounds a monetary value to the nearest whole so'm (UZS has no subunit in
    everyday use), with standard half-up rounding."""
    return Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def to_decimal(value) -> Decimal:
    """Converts a float/int/str/Decimal/None into a Decimal, safely - going through
    `str()` first so a float's binary representation can't leak spurious digits
    (e.g. `Decimal(0.1)` vs. the correct `Decimal(str(0.1))`)."""
    if value is None:
        return ZERO
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def pct_of(amount, percentage) -> Decimal:
    """Returns `percentage`% of `amount`, rounded to the nearest whole so'm. Centralizes
    the float(percentage) -> Decimal conversion so callers never mix Decimal and float
    directly (Python raises TypeError on that)."""
    return round_som(to_decimal(amount) * to_decimal(percentage) / Decimal(100))


def lock_user_for_update(db: Session, user_id: Optional[int]) -> Optional[User]:
    """Fetches a user row with a row-level lock so two concurrent requests touching
    the same balance can't race each other.

    On Postgres (production) this takes a real `SELECT ... FOR UPDATE` lock for the
    rest of the transaction. On SQLite (local dev) `FOR UPDATE` isn't supported, so
    SQLAlchemy silently omits it - that's fine, since SQLite already serializes all
    writes at the database level.
    """
    if user_id is None:
        return None
    return db.query(User).filter(User.id == user_id).with_for_update().first()
