"""Audit service — fire-and-forget audit event logging.

Never raises. Audit failures must never break the main request.
"""

from app.extensions import db
from app.models.audit_log import AuditLog


def log_action(
    action: str,
    user_id: int = None,
    store_id: int = None,
    entity_type: str = None,
    entity_id: int = None,
    old_value: str = None,
    new_value: str = None,
    ip_address: str = None,
    user_agent: str = None,
) -> None:
    try:
        entry = AuditLog(
            user_id=user_id,
            store_id=store_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.session.add(entry)
        db.session.commit()
    except Exception:
        # Audit failure must never surface to the caller
        try:
            db.session.rollback()
        except Exception:
            pass
