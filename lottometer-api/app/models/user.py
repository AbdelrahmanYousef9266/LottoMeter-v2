"""User model — employees and admins."""

from datetime import datetime, timezone
from app.extensions import db


class User(db.Model):
    """Represents a user (admin or employee) within a store."""

    __tablename__ = "users"

    user_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(100), nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(50), nullable=False, default="employee")
    store_id = db.Column(
        db.Integer,
        db.ForeignKey("stores.store_id"),
        nullable=False,
        index=True,
    )
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        db.UniqueConstraint("store_id", "username", name="uq_users_store_username"),
        db.CheckConstraint("role IN ('admin', 'employee')", name="ck_users_role"),
    )

    def __repr__(self) -> str:
        return f"<User id={self.user_id} username={self.username} role={self.role}>"