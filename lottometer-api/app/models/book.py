"""Book model — a lottery ticket book."""

from datetime import datetime, timezone
from app.extensions import db


class Book(db.Model):
    """A lottery ticket book. Created via slot assignment, never standalone."""

    __tablename__ = "books"

    book_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    book_name = db.Column(db.String(150), nullable=True)
    barcode = db.Column(db.String(100), nullable=False)
    static_code = db.Column(db.String(100), nullable=True, index=True)
    start_position = db.Column(db.Integer, nullable=True)
    ticket_price = db.Column(db.Numeric(10, 2), nullable=True)
    slot_id = db.Column(
        db.Integer,
        db.ForeignKey("slots.slot_id"),
        nullable=True,
    )
    store_id = db.Column(
        db.Integer,
        db.ForeignKey("stores.store_id"),
        nullable=False,
        index=True,
    )
    is_active = db.Column(db.Boolean, nullable=False, default=False)
    is_sold = db.Column(db.Boolean, nullable=False, default=False)
    returned_at = db.Column(db.DateTime, nullable=True)
    returned_by_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.user_id"),
        nullable=True,
    )
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        db.UniqueConstraint("store_id", "barcode", name="uq_books_store_barcode"),
        db.UniqueConstraint("store_id", "static_code", name="uq_books_store_static_code"),
        db.CheckConstraint(
            "ticket_price IS NULL OR ticket_price IN (1.00, 2.00, 3.00, 5.00, 10.00, 20.00)",
            name="ck_books_ticket_price",
        ),
    )

    def __repr__(self) -> str:
        return f"<Book id={self.book_id} static_code={self.static_code} active={self.is_active}>"