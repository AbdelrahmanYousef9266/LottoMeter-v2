"""Report routes — /api/reports/*"""

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from app.services import report_service
from app.auth_helpers import current_store_id


report_bp = Blueprint("report", __name__, url_prefix="/api/reports")


@report_bp.route("/shift/<int:shift_id>", methods=["GET"])
@jwt_required()
def get_shift_report(shift_id):
    """Full main shift report."""
    payload = report_service.build_main_shift_report(
        store_id=current_store_id(), main_shift_id=shift_id
    )
    return jsonify(payload), 200