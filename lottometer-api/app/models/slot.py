"""Slot model — physical location for a lottery book."""

from datetime import datetime, timezone
from app.extensions import db


class Slot(db.Model):
    """A physical slot in the store, holds at most one active Book."""

    __tablename__ = "slots"

    slot_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    slot_name = db.Column(db.String(100), nullable=False)
    ticket_price = db.Column(db.Numeric(10, 2), nullable=False)
    deleted_at = db.Column(db.DateTime, nullable=True)
    store_id = db.Column(
        db.Integer,
        db.ForeignKey("stores.store_id"),
        nullable=False,
        index=True,
    )
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        # Partial unique index: slot_name unique within store, but only for non-deleted rows
        db.Index(
            "uq_slots_store_name_active",
            "store_id",
            "slot_name",
            unique=True,
            sqlite_where=db.text("deleted_at IS NULL"),
            postgresql_where=db.text("deleted_at IS NULL"),
        ),
        db.CheckConstraint(
            "ticket_price IN (1.00, 2.00, 3.00, 5.00, 10.00, 20.00)",
            name="ck_slots_ticket_price",
        ),
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None

    def __repr__(self) -> str:
        return f"<Slot id={self.slot_id} name={self.slot_name} price={self.ticket_price}>"