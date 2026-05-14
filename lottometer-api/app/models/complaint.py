from datetime import datetime, timezone
from app.extensions import db


class Complaint(db.Model):
    __tablename__ = "complaints"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    store_id = db.Column(
        db.Integer,
        db.ForeignKey("stores.store_id"),
        nullable=False,
        index=True,
    )
    subject = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    status = db.Column(
        db.String(20),
        nullable=False,
        default="open",
        server_default="open",
    )
    priority = db.Column(
        db.String(20),
        nullable=False,
        default="medium",
        server_default="medium",
    )
    staff_reply = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    store = db.relationship("Store", backref=db.backref("complaints", lazy="dynamic"))

    __table_args__ = (
        db.CheckConstraint(
            "status IN ('open', 'resolved')",
            name="ck_complaints_status",
        ),
        db.CheckConstraint(
            "priority IN ('low', 'medium', 'high')",
            name="ck_complaints_priority",
        ),
    )

    def __repr__(self):
        return f"<Complaint id={self.id} store_id={self.store_id} status={self.status}>"
