"""ShiftExtraSales model — whole-book sales (no Book row)."""

from datetime import datetime, timezone
from app.extensions import db


class ShiftExtraSales(db.Model):
    """Whole-book sales. Decoupled from Book — these books never enter inventory."""

    __tablename__ = "shift_extra_sales"

    extra_sale_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    shift_id = db.Column(
        db.Integer,
        db.ForeignKey("shift_details.shift_id"),
        nullable=False,
        index=True,
    )
    sale_type = db.Column(db.String(25), nullable=False)  # 'whole_book' (extensible)
    scanned_barcode = db.Column(db.String(100), nullable=False)
    ticket_price = db.Column(db.Numeric(10, 2), nullable=False)
    ticket_count = db.Column(db.Integer, nullable=False)
    value = db.Column(db.Numeric(10, 2), nullable=False)
    note = db.Column(db.String(500), nullable=True)
    created_by_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.user_id"),
        nullable=False,
    )
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    store_id = db.Column(
        db.Integer,
        db.ForeignKey("stores.store_id"),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        db.CheckConstraint(
            "ticket_price IN (1.00, 2.00, 3.00, 5.00, 10.00, 20.00)",
            name="ck_shift_extra_sales_price",
        ),
    )

    def __repr__(self) -> str:
        return f"<ShiftExtraSales id={self.extra_sale_id} type={self.sale_type} value={self.value}>"