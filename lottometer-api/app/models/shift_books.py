"""ShiftBooks model — scan records (open + close per book per sub-shift)."""

from datetime import datetime, timezone
from app.extensions import db


class ShiftBooks(db.Model):
    """A single scan event during a sub-shift. Composite PK allows two rows
    per book per sub-shift: one open scan + one close scan.
    """

    __tablename__ = "shift_books"

    shift_id = db.Column(
        db.Integer,
        db.ForeignKey("shift_details.shift_id"),
        primary_key=True,
    )
    barcode = db.Column(db.String(100), primary_key=True)
    scan_type = db.Column(db.String(10), primary_key=True)  # 'open' | 'close'

    start_at_scan = db.Column(db.Integer, nullable=False)
    is_last_ticket = db.Column(db.Boolean, nullable=False, default=False)
    scan_source = db.Column(
        db.String(25),
        nullable=False,
        default="scanned",
    )
    slot_id = db.Column(
        db.Integer,
        db.ForeignKey("slots.slot_id"),
        nullable=False,
    )
    store_id = db.Column(
        db.Integer,
        db.ForeignKey("stores.store_id"),
        nullable=False,
        index=True,
    )
    scanned_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    scanned_by_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.user_id"),
        nullable=False,
    )

    __table_args__ = (
        db.CheckConstraint(
            "scan_type IN ('open', 'close')",
            name="ck_shift_books_scan_type",
        ),
        db.CheckConstraint(
            "scan_source IN ('scanned', 'carried_forward', 'whole_book_sale', 'returned_to_vendor')",
            name="ck_shift_books_scan_source",
        ),
        db.Index("ix_shift_books_store_scanned_at", "store_id", "scanned_at"),
    )

    def __repr__(self) -> str:
        return f"<ShiftBooks shift={self.shift_id} barcode={self.barcode} type={self.scan_type}>"