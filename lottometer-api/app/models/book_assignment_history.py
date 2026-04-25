"""BookAssignmentHistory model — audit log for assignment events."""

from datetime import datetime, timezone
from app.extensions import db


class BookAssignmentHistory(db.Model):
    """One row per assignment event (assign, reassign, unassign, sold, returned)."""

    __tablename__ = "book_assignment_history"

    assignment_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    book_id = db.Column(
        db.Integer,
        db.ForeignKey("books.book_id"),
        nullable=False,
        index=True,
    )
    slot_id = db.Column(
        db.Integer,
        db.ForeignKey("slots.slot_id"),
        nullable=False,
    )
    ticket_price = db.Column(db.Numeric(10, 2), nullable=False)
    assigned_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    unassigned_at = db.Column(db.DateTime, nullable=True)
    assigned_by_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.user_id"),
        nullable=False,
    )
    unassigned_by_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.user_id"),
        nullable=True,
    )
    unassign_reason = db.Column(db.String(50), nullable=True)
    store_id = db.Column(
        db.Integer,
        db.ForeignKey("stores.store_id"),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        db.Index("ix_bah_book_unassigned", "book_id", "unassigned_at"),
        db.CheckConstraint(
            "unassign_reason IS NULL OR unassign_reason IN ('reassigned', 'unassigned', 'sold', 'returned_to_vendor')",
            name="ck_bah_unassign_reason",
        ),
    )

    def __repr__(self) -> str:
        return f"<BookAssignmentHistory id={self.assignment_id} book={self.book_id} slot={self.slot_id}>"