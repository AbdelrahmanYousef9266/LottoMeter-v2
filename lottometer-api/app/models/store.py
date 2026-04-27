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
        default="camera_single",
        server_default="camera_single",
    )
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    def __repr__(self) -> str:
        return f"<Store id={self.store_id} code={self.store_code}>"