from app.extensions import db


class StoreSettings(db.Model):
    __tablename__ = "store_settings"

    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(
        db.Integer,
        db.ForeignKey("stores.store_id"),
        nullable=False,
        unique=True,
    )
    timezone = db.Column(db.String(50), nullable=False, default="America/New_York")
    currency = db.Column(db.String(10), nullable=False, default="USD")
    business_hours_start = db.Column(db.String(5), nullable=True)   # "09:00"
    business_hours_end = db.Column(db.String(5), nullable=True)     # "23:00"
    max_employees = db.Column(db.Integer, nullable=False, default=10)
    auto_close_business_day = db.Column(
        db.Boolean, nullable=False, default=False, server_default="false"
    )
    notify_email = db.Column(db.String(150), nullable=True)
    notify_on_variance = db.Column(
        db.Boolean, nullable=False, default=True, server_default="true"
    )
    notify_on_shift_close = db.Column(
        db.Boolean, nullable=False, default=False, server_default="false"
    )

    def __repr__(self) -> str:
        return f"<StoreSettings store_id={self.store_id} tz={self.timezone}>"
