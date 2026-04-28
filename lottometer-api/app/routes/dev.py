"""Dev-only routes — only registered when DEBUG=True."""

from flask import Blueprint, jsonify, current_app
from app.extensions import db

dev_bp = Blueprint("dev", __name__, url_prefix="/api/dev")


@dev_bp.route("/wipe", methods=["POST"])
def wipe():
    """Drop and recreate all tables. Only available in debug mode."""
    if not current_app.debug:
        return jsonify({"error": {"code": "FORBIDDEN", "message": "Not available in production."}}), 403
    db.drop_all()
    db.create_all()
    return jsonify({"message": "Database wiped and recreated."}), 200
