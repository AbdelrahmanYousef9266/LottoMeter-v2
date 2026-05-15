"""SyncEvent — append-only telemetry for mobile sync operations.

Never store cash amounts, PINs, or PII here.
"""

from datetime import datetime, timezone
from app.extensions import db


class SyncEvent(db.Model):
    __tablename__ = "sync_events"

    id         = db.Column(db.Integer, primary_key=True, autoincrement=True)
    store_id   = db.Column(db.Integer, db.ForeignKey("stores.store_id"), nullable=False, index=True)
    operation  = db.Column(db.String(50), nullable=False)   # "scan", "open_shift", "close_shift"
    status     = db.Column(db.String(20), nullable=False)   # "ok", "error"
    error_code = db.Column(db.String(100), nullable=True)
    discarded  = db.Column(db.Boolean, nullable=False, default=False, server_default="false", index=True)
    item_uuid  = db.Column(db.String(36), nullable=True)    # mobile sync_queue item uuid, if provided
    created_at = db.Column(
        db.DateTime, nullable=False,
        default=lambda: datetime.now(timezone.utc), index=True,
    )

    def to_dict(self):
        return {
            "id":         self.id,
            "store_id":   self.store_id,
            "operation":  self.operation,
            "status":     self.status,
            "error_code": self.error_code,
            "discarded":  self.discarded,
            "item_uuid":  self.item_uuid,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
        }


def log_sync_event(store_id: int, operation: str, status: str, **kwargs) -> None:
    """Fire-and-forget telemetry helper — never raises, never blocks the caller."""
    try:
        db.session.add(SyncEvent(
            store_id=store_id, operation=operation, status=status, **kwargs
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()
