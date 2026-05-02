"""BusinessDay model — one per store per calendar date, auto-managed."""

from datetime import datetime, timezone
from app.extensions import db


class BusinessDay(db.Model):
    # BR-BD-01: Only one BusinessDay per store per calendar date
    # BR-BD-02: BusinessDay is auto-created — never manually opened by employees
    # BR-BD-03: BusinessDay can only be closed by an admin
    # BR-BD-04: BusinessDay cannot be closed while any EmployeeShift is still open

    __tablename__ = "business_days"

    id            = db.Column(db.Integer, primary_key=True, autoincrement=True)
    uuid          = db.Column(db.String(36), nullable=True, index=True)
    store_id      = db.Column(db.Integer, db.ForeignKey("stores.store_id"), nullable=False, index=True)
    business_date = db.Column(db.Date, nullable=False)
    opened_at     = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    closed_at     = db.Column(db.DateTime, nullable=True)
    status        = db.Column(db.String(20), nullable=False, default="open")
    # status: "open" | "closed" | "auto_closed"

    # Aggregates set at close time
    total_sales    = db.Column(db.Numeric(10, 2), nullable=True)
    total_variance = db.Column(db.Numeric(10, 2), nullable=True)

    __table_args__ = (
        db.UniqueConstraint("store_id", "business_date", name="uq_business_day_per_store"),
        db.CheckConstraint(
            "status IN ('open', 'closed', 'auto_closed')",
            name="ck_business_day_status",
        ),
    )

    def __repr__(self) -> str:
        return f"<BusinessDay id={self.id} store={self.store_id} date={self.business_date} status={self.status}>"
