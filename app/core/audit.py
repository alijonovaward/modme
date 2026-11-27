import json
from typing import Optional

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_action(
    db: Session,
    actor_id: Optional[int],
    action: str,
    target_type: str,
    target_id: int,
    details: Optional[dict] = None,
) -> None:
    """Records a sensitive action (block/delete/restore, password change, a rate or
    price change, ...) for later review. Call this alongside the state change, in
    the same request/transaction - it's a plain insert, not committed separately."""
    db.add(
        AuditLog(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=json.dumps(details, default=str) if details else None,
        )
    )
