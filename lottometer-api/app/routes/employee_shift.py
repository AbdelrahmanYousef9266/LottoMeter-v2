"""EmployeeShift routes — /api/shifts/*"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.employee_shift_schema import EmployeeShiftSchema
from app.schemas.close_schema import CloseShiftSchema
from app.schemas.void_schema import VoidShiftSchema
from app.services import employee_shift_service
from app.services.report_service import get_shift_report
from app.services.audit_service import log_action
from app.models.employee_shift import EmployeeShift
from app.errors import NotFoundError, ValidationError
from app.auth_helpers import admin_required, current_store_id, current_user_id


employee_shift_bp = Blueprint("employee_shift", __name__, url_prefix="/api/shifts")

_schema = EmployeeShiftSchema()


# ---------- POST /api/shifts — open a new shift ----------

@employee_shift_bp.route("", methods=["POST"])
@jwt_required()
def open_shift():
    store_id = current_store_id()
    user_id = current_user_id()
    shift, pending_books, carried_forward_count = employee_shift_service.open_employee_shift(
        store_id=store_id,
        user_id=user_id,
    )
    log_action("shift_opened", user_id=user_id, store_id=store_id,
               entity_type="shift", entity_id=shift.id,
               ip_address=request.remote_addr,
               user_agent=(request.headers.get("User-Agent") or "")[:200])
    return jsonify({
        "employee_shift": _schema.dump(shift),
        "carried_forward_count": carried_forward_count,
        "pending_scans": [
            {
                "book_id":     b.book_id,
                "book_name":   b.book_name,
                "static_code": b.static_code,
                "slot_id":     b.slot_id,
            }
            for b in pending_books
        ],
    }), 201


# ---------- GET /api/shifts — list shifts ----------

@employee_shift_bp.route("", methods=["GET"])
@jwt_required()
def list_shifts():
    store_id = current_store_id()

    raw_bd = request.args.get("business_day_id")
    if raw_bd is not None:
        try:
            business_day_id = int(raw_bd)
        except ValueError:
            raise ValidationError("business_day_id must be an integer.")
        shifts = (
            EmployeeShift.query
            .filter_by(business_day_id=business_day_id, store_id=store_id)
            .order_by(EmployeeShift.shift_number)
            .all()
        )
    else:
        shifts = (
            EmployeeShift.query
            .filter_by(store_id=store_id)
            .order_by(EmployeeShift.opened_at.desc())
            .all()
        )

    return jsonify({"shifts": [_schema.dump(s) for s in shifts]}), 200


# ---------- GET /api/shifts/<shift_id> — get one shift ----------

@employee_shift_bp.route("/<int:shift_id>", methods=["GET"])
@jwt_required()
def get_shift(shift_id):
    shift = EmployeeShift.query.filter_by(id=shift_id, store_id=current_store_id()).first()
    if shift is None:
        raise NotFoundError("Employee shift not found.", code="SHIFT_NOT_FOUND")
    return jsonify({"shift": _schema.dump(shift)}), 200


# ---------- GET /api/shifts/<shift_id>/summary — live preview ----------

@employee_shift_bp.route("/<int:shift_id>/summary", methods=["GET"])
@jwt_required()
def get_shift_summary(shift_id):
    summary = employee_shift_service.get_running_summary(current_store_id(), shift_id)
    return jsonify(summary), 200


# ---------- PUT /api/shifts/<shift_id>/close — close shift ----------

@employee_shift_bp.route("/<int:shift_id>/close", methods=["PUT"])
@jwt_required()
def close_shift(shift_id):
    try:
        data = CloseShiftSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    store_id = current_store_id()
    user_id = current_user_id()
    shift = employee_shift_service.close_employee_shift(
        store_id=store_id,
        shift_id=shift_id,
        user_id=user_id,
        cash_in_hand=data["cash_in_hand"],
        gross_sales=data["gross_sales"],
        cash_out=data["cash_out"],
        cancels=str(data["cancels"]),
    )
    report = get_shift_report(store_id, shift_id)
    log_action("shift_closed", user_id=user_id, store_id=store_id,
               entity_type="shift", entity_id=shift.id,
               ip_address=request.remote_addr,
               user_agent=(request.headers.get("User-Agent") or "")[:200])
    return jsonify({
        "shift":  _schema.dump(shift),
        "report": report,
    }), 200


# ---------- POST /api/shifts/<shift_id>/void — void shift (admin only) ----------

@employee_shift_bp.route("/<int:shift_id>/void", methods=["POST"])
@admin_required
def void_shift(shift_id):
    try:
        data = VoidShiftSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    store_id = current_store_id()
    admin_user_id = current_user_id()
    shift = employee_shift_service.void_employee_shift(
        store_id=store_id,
        shift_id=shift_id,
        admin_user_id=admin_user_id,
        reason=data["reason"],
    )
    log_action("shift_voided", user_id=admin_user_id, store_id=store_id,
               entity_type="shift", entity_id=shift.id,
               new_value=data["reason"],
               ip_address=request.remote_addr,
               user_agent=(request.headers.get("User-Agent") or "")[:200])
    return jsonify({"shift": _schema.dump(shift)}), 200
