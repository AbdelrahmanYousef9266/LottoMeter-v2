from flask import Blueprint, request, jsonify
from marshmallow import ValidationError as MarshmallowValidationError

from app.extensions import db, limiter
from app.models.contact_submission import ContactSubmission
from app.schemas.public_schema import PublicContactSchema, PublicWaitlistSchema

public_bp = Blueprint("public", __name__, url_prefix="/api")


def _save_contact(submission_type: str, data: dict):
    """Persist a validated contact/apply submission. Returns a Flask response."""
    try:
        sub = ContactSubmission(
            submission_type=submission_type,
            full_name=data["full_name"],
            email=data["email"],
            business_name=data.get("business_name"),
            phone=data.get("phone"),
            city=data.get("city"),
            num_employees=data.get("num_employees"),
            how_heard=data.get("how_heard"),
            message=data.get("message"),
        )
        db.session.add(sub)
        db.session.commit()
        return jsonify({"message": "Submission received. We will be in touch soon!"}), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Server error. Please try again."}), 500


def _is_honeypot_triggered(body: dict) -> bool:
    return bool(body.get("website"))


@public_bp.post("/contact")
@limiter.limit("5 per minute")
def contact():
    body = request.get_json(silent=True) or {}
    if _is_honeypot_triggered(body):
        return jsonify({"message": "Submission received. We will be in touch soon!"}), 200
    try:
        data = PublicContactSchema().load(body)
    except MarshmallowValidationError as err:
        return jsonify({"error": err.messages}), 400
    return _save_contact("contact", data)


@public_bp.post("/apply")
@limiter.limit("3 per hour")
def apply():
    body = request.get_json(silent=True) or {}
    if _is_honeypot_triggered(body):
        return jsonify({"message": "Submission received. We will be in touch soon!"}), 200
    try:
        data = PublicContactSchema().load(body)
    except MarshmallowValidationError as err:
        return jsonify({"error": err.messages}), 400
    return _save_contact("apply", data)


@public_bp.post("/waitlist")
@limiter.limit("5 per minute")
def waitlist():
    body = request.get_json(silent=True) or {}
    if _is_honeypot_triggered(body):
        return jsonify({"message": "You are on the list! We will notify you when we launch."}), 200
    try:
        data = PublicWaitlistSchema().load(body)
    except MarshmallowValidationError as err:
        return jsonify({"error": err.messages}), 400
    try:
        sub = ContactSubmission(
            submission_type="waitlist",
            full_name=data["name"],
            email=data["email"],
            business_name=data.get("store_name"),
            phone=data.get("phone"),
        )
        db.session.add(sub)
        db.session.commit()
        return jsonify({"message": "You are on the list! We will notify you when we launch."}), 201
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Server error. Please try again."}), 500
