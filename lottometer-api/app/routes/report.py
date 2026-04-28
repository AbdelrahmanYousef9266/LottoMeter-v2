"""Report routes — /api/reports/*"""

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from app.services import report_service, shift_service
from app.auth_helpers import current_store_id, current_role
from app.errors import NotFoundError


report_bp = Blueprint("report", __name__, url_prefix="/api/reports")


@report_bp.route("/shift/<int:shift_id>", methods=["GET"])
@jwt_required()
def get_shift_report(shift_id):
    """Full main shift report."""
    store_id = current_store_id()

    if current_role() == "employee":
        accessible_ids = {
            s.shift_id for s in shift_service.list_main_shifts_for_employee(store_id)
        }
        if shift_id not in accessible_ids:
            raise NotFoundError("Shift report not found.", code="SHIFT_NOT_FOUND")

    payload = report_service.build_main_shift_report(
        store_id=store_id, main_shift_id=shift_id
    )
    return jsonify(payload), 200
