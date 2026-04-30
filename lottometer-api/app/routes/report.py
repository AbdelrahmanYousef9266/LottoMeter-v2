"""Report routes — /api/reports/*"""

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from app.services import report_service
from app.models.employee_shift import EmployeeShift
from app.auth_helpers import current_store_id, current_role, current_user_id
from app.errors import NotFoundError


report_bp = Blueprint("report", __name__, url_prefix="/api/reports")


@report_bp.route("/shift/<int:shift_id>", methods=["GET"])
@jwt_required()
def get_shift_report(shift_id):
    """Full employee shift report."""
    store_id = current_store_id()

    if current_role() == "employee":
        accessible_ids = {
            s.id for s in EmployeeShift.query.filter_by(
                store_id=store_id, employee_id=current_user_id()
            ).all()
        }
        if shift_id not in accessible_ids:
            raise NotFoundError("Shift report not found.", code="SHIFT_NOT_FOUND")

    payload = report_service.get_shift_report(
        store_id=store_id, employee_shift_id=shift_id
    )
    return jsonify(payload), 200
