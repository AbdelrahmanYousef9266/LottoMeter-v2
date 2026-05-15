"""EmployeeShift model — one employee session inside a BusinessDay."""

from datetime import datetime, timezone
from app.extensions import db


class EmployeeShift(db.Model):
    # BR-ES-01: Only one EmployeeShift may be open at a time per store
    # BR-ES-02: shift_number increments per BusinessDay (resets each new BusinessDay)
    # BR-ES-03: Shift #2+ carries forward close positions only if previous status == "correct"
    # BR-ES-04: All active books must have close scans before EmployeeShift can be closed

    __tablename__ = "employee_shifts"

    id              = db.Column(db.Integer, primary_key=True, autoincrement=True)
    uuid            = db.Column(db.String(36), nullable=True, unique=True, index=True)
    business_day_id = db.Column(db.Integer, db.ForeignKey("business_days.id"), nullable=False, index=True)
    store_id        = db.Column(db.Integer, db.ForeignKey("stores.store_id"), nullable=False, index=True)
    employee_id     = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    shift_number    = db.Column(db.Integer, nullable=False)
    opened_at       = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    closed_at       = db.Column(db.DateTime, nullable=True)
    status          = db.Column(db.String(20), nullable=False, default="open")
    # status: "open" | "closed"

    # Financial close fields (all set at close time, null while open)
    cash_in_hand      = db.Column(db.Numeric(10, 2), nullable=True)
    gross_sales       = db.Column(db.Numeric(10, 2), nullable=True)
    cash_out          = db.Column(db.Numeric(10, 2), nullable=True)
    cancels           = db.Column(db.Numeric(10, 2), nullable=True, default=0)
    tickets_total     = db.Column(db.Numeric(10, 2), nullable=True)
    expected_cash     = db.Column(db.Numeric(10, 2), nullable=True)
    difference        = db.Column(db.Numeric(10, 2), nullable=True)
    shift_status      = db.Column(db.String(20), nullable=True)  # correct | over | short
    closed_by_user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=True)

    # Void fields
    voided            = db.Column(db.Boolean, nullable=False, default=False)
    voided_at         = db.Column(db.DateTime, nullable=True)
    voided_by_user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=True)
    void_reason       = db.Column(db.String(500), nullable=True)

    __table_args__ = (
        # BR-ES-01: only one open (non-voided) shift per store at a time
        db.Index(
            "uq_one_open_employee_shift_per_store",
            "store_id",
            unique=True,
            sqlite_where=db.text("status = 'open' AND voided = 0"),
            postgresql_where=db.text("status = 'open' AND voided = FALSE"),
        ),
        # BR-ES-02: shift numbers are unique within a BusinessDay
        db.UniqueConstraint("business_day_id", "shift_number", name="uq_shift_number_per_business_day"),
        db.CheckConstraint(
            "status IN ('open', 'closed')",
            name="ck_employee_shift_status",
        ),
        db.CheckConstraint(
            "shift_status IS NULL OR shift_status IN ('correct', 'over', 'short')",
            name="ck_employee_shift_financial_status",
        ),
        db.CheckConstraint(
            "NOT voided OR void_reason IS NOT NULL",
            name="ck_employee_shift_void_requires_reason",
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<EmployeeShift id={self.id} bd={self.business_day_id} "
            f"#{self.shift_number} status={self.status}>"
        )
