"""ShiftDetails model — main shifts and sub-shifts (self-referential)."""

from datetime import datetime, timezone
from app.extensions import db


class ShiftDetails(db.Model):
    """Main shift if main_shift_id IS NULL; otherwise a sub-shift."""

    __tablename__ = "shift_details"

    shift_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    shift_start_time = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    shift_end_time = db.Column(db.DateTime, nullable=True)

    # Cash values (only on sub-shifts, set at close)
    cash_in_hand = db.Column(db.Numeric(10, 2), nullable=True)
    gross_sales = db.Column(db.Numeric(10, 2), nullable=True)
    cash_out = db.Column(db.Numeric(10, 2), nullable=True)
    tickets_total = db.Column(db.Numeric(10, 2), nullable=True)
    expected_cash = db.Column(db.Numeric(10, 2), nullable=True)
    difference = db.Column(db.Numeric(10, 2), nullable=True)
    shift_status = db.Column(db.String(20), nullable=True)  # correct/over/short

    is_shift_open = db.Column(db.Boolean, nullable=False, default=True)

    # Self-reference: NULL = main shift; set = sub-shift
    main_shift_id = db.Column(
        db.Integer,
        db.ForeignKey("shift_details.shift_id"),
        nullable=True,
    )
    shift_number = db.Column(db.Integer, nullable=False, default=1)

    opened_by_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.user_id"),
        nullable=False,
    )
    closed_by_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.user_id"),
        nullable=True,
    )

    voided = db.Column(db.Boolean, nullable=False, default=False)
    voided_at = db.Column(db.DateTime, nullable=True)
    voided_by_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.user_id"),
        nullable=True,
    )
    void_reason = db.Column(db.String(500), nullable=True)

    store_id = db.Column(
        db.Integer,
        db.ForeignKey("stores.store_id"),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        # Partial unique: only one open main shift per store
        db.Index(
            "uq_one_open_main_shift_per_store",
            "store_id",
            unique=True,
            sqlite_where=db.text("main_shift_id IS NULL AND is_shift_open = 1"),
            postgresql_where=db.text("main_shift_id IS NULL AND is_shift_open = TRUE"),
        ),
        # Sub-shift numbers unique within a main shift
        db.UniqueConstraint(
            "main_shift_id", "shift_number", name="uq_subshift_number_per_main"
        ),
        db.CheckConstraint(
            "main_shift_id IS NULL OR main_shift_id != shift_id",
            name="ck_no_self_reference",
        ),
        db.CheckConstraint(
            "voided = 0 OR void_reason IS NOT NULL",
            name="ck_void_requires_reason",
        ),
    )

    @property
    def is_main_shift(self) -> bool:
        return self.main_shift_id is None

    @property
    def is_sub_shift(self) -> bool:
        return self.main_shift_id is not None

    def __repr__(self) -> str:
        kind = "main" if self.is_main_shift else f"sub#{self.shift_number}"
        return f"<ShiftDetails id={self.shift_id} {kind} open={self.is_shift_open}>"