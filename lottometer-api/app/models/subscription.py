from datetime import datetime, timezone
from app.extensions import db


class Subscription(db.Model):
    __tablename__ = "subscriptions"

    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(
        db.Integer,
        db.ForeignKey("stores.store_id"),
        nullable=False,
        unique=True,
    )
    plan = db.Column(db.String(20), nullable=False, default="basic")
    status = db.Column(db.String(20), nullable=False, default="trial")
    # status: trial / active / expired / suspended / cancelled

    trial_ends_at = db.Column(db.DateTime, nullable=True)
    current_period_start = db.Column(db.DateTime, nullable=True)
    current_period_end = db.Column(db.DateTime, nullable=True)
    stripe_customer_id = db.Column(db.String(100), nullable=True)
    stripe_subscription_id = db.Column(db.String(100), nullable=True)
    cancelled_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        db.CheckConstraint(
            "status IN ('trial', 'active', 'expired', 'suspended', 'cancelled')",
            name="ck_subscription_status",
        ),
    )

    def __repr__(self) -> str:
        return f"<Subscription store_id={self.store_id} status={self.status}>"
