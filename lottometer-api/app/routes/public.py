from flask import Blueprint, request, jsonify
from app.extensions import db
from app.models.contact_submission import ContactSubmission

public_bp = Blueprint("public", __name__, url_prefix="/api")


def _save_submission(submission_type: str):
    try:
        data = request.get_json(silent=True) or {}

        full_name = (data.get("full_name") or "").strip()
        email = (data.get("email") or "").strip()

        if not full_name or not email:
            return jsonify({"error": "full_name and email are required."}), 400

        sub = ContactSubmission(
            submission_type=submission_type,
            full_name=full_name,
            business_name=(data.get("business_name") or "").strip() or None,
            email=email,
            phone=(data.get("phone") or "").strip() or None,
            city=(data.get("city") or "").strip() or None,
            num_employees=(data.get("num_employees") or "").strip() or None,
            how_heard=(data.get("how_heard") or "").strip() or None,
            message=(data.get("message") or "").strip() or None,
        )
        db.session.add(sub)
        db.session.commit()
        return jsonify({"message": "Submission received. We will be in touch soon!"}), 201

    except Exception:
        db.session.rollback()
        return jsonify({"error": "Server error. Please try again."}), 500


@public_bp.post("/contact")
def contact():
    return _save_submission("contact")


@public_bp.post("/apply")
def apply():
    return _save_submission("apply")


@public_bp.post("/waitlist")
def waitlist():
    try:
        data = request.get_json(silent=True) or {}

        full_name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip()

        if not full_name or not email:
            return jsonify({"error": "name and email are required."}), 400

        sub = ContactSubmission(
            submission_type="waitlist",
            full_name=full_name,
            email=email,
            business_name=(data.get("store_name") or "").strip() or None,
            phone=(data.get("phone") or "").strip() or None,
        )
        db.session.add(sub)
        db.session.commit()
        return jsonify({"message": "You are on the list! We will notify you when we launch."}), 201

    except Exception:
        db.session.rollback()
        return jsonify({"error": "Server error. Please try again."}), 500
