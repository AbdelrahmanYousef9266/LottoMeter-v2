"""Store model — root tenant entity.

Every non-Store table carries a store_id FK to this table for multi-tenancy.

See SRS §11 and ERD §1 for full schema.
"""

from datetime import datetime, timezone
from app.extensions import db


class Store(db.Model):
    """Represents a retail store. Root tenant entity."""

    __tablename__ = "stores"

    store_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    store_name = db.Column(db.String(150), nullable=False)
    store_code = db.Column(db.String(50), unique=True, nullable=False)
    store_pin_hash = db.Column(db.String(256), nullable=True)  # set during setup
    scan_mode = db.Column(
        db.String(30),
        nullable=False,
        default="hardware_scanner",
        server_default="hardware_scanner",
    )
    suspended = db.Column(
        db.Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    is_active = db.Column(
        db.Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    email = db.Column(db.String(150), nullable=True)
    phone = db.Column(db.String(30), nullable=True)
    address = db.Column(db.String(250), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    state = db.Column(db.String(50), nullable=True)
    zip_code = db.Column(db.String(20), nullable=True)
    owner_name = db.Column(db.String(150), nullable=True)
    created_by = db.Column(
        db.Integer,
        db.ForeignKey("users.user_id", use_alter=True, name="fk_stores_created_by"),
        nullable=True,
    )
    notes = db.Column(db.Text, nullable=True)
    force_full_resync = db.Column(
        db.Boolean, nullable=False, default=False, server_default="false"
    )
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    subscription = db.relationship(
        "Subscription", backref="store", uselist=False
    )

    def __repr__(self) -> str:
        return f"<Store id={self.store_id} code={self.store_code}>"