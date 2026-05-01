from datetime import datetime, timezone
from app.extensions import db


class ContactSubmission(db.Model):
    __tablename__ = "contact_submissions"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    submission_type = db.Column(db.String(20), nullable=False, default="contact")  # 'contact' | 'apply'
    full_name = db.Column(db.String(150), nullable=False)
    business_name = db.Column(db.String(150), nullable=True)
    email = db.Column(db.String(200), nullable=False)
    phone = db.Column(db.String(50), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    num_employees = db.Column(db.String(20), nullable=True)
    how_heard = db.Column(db.String(50), nullable=True)
    message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<ContactSubmission id={self.id} type={self.submission_type} email={self.email}>"
