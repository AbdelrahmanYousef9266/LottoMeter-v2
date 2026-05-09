"""BusinessDay routes — /api/business-days/*"""

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from app.schemas.business_day_schema import BusinessDaySchema
from app.services import business_day_service
from app.auth_helpers import admin_required, current_store_id, current_user_id
from app.models.employee_shift import EmployeeShift


business_day_bp = Blueprint("business_day", __name__, url_prefix="/api/business-days")

_schema = BusinessDaySchema()


@business_day_bp.route("", methods=["GET"])
@jwt_required()
def list_days():
    store_id = current_store_id()
    business_day_service.auto_close_stale_business_days(store_id)
    days = business_day_service.list_business_days(store_id)
    return jsonify({"business_days": [_schema.dump(d) for d in days]})


@business_day_bp.route("/today", methods=["GET"])
@jwt_required()
def get_today():
    """Auto-creates today's BusinessDay if it doesn't exist yet.

    The mobile app calls this on load to ensure a BusinessDay is always available
    before any EmployeeShift is opened.
    """
    day = business_day_service.get_or_create_business_day(current_store_id())
    return jsonify({"business_day": _schema.dump(day)})


@business_day_bp.route("/<int:day_id>", methods=["GET"])
@jwt_required()
def get_day(day_id):
    store_id = current_store_id()
    day = business_day_service.get_business_day(store_id, day_id)

    shifts = (
        EmployeeShift.query
        .filter_by(business_day_id=day_id, store_id=store_id)
        .order_by(EmployeeShift.shift_number)
        .all()
    )

    return jsonify({
        "business_day": _schema.dump(day),
        "shifts": [
            {
                "shift_id":     s.id,
                "shift_number": s.shift_number,
                "status":       s.status,
                "shift_status": s.shift_status,
                "voided":       s.voided,
                "employee_id":  s.employee_id,
                "opened_at":    s.opened_at.isoformat() + "Z",
                "closed_at":    s.closed_at.isoformat() + "Z" if s.closed_at else None,
            }
            for s in shifts
        ],
    })


@business_day_bp.route("/<int:day_id>/ticket-breakdown", methods=["GET"])
@jwt_required()
def get_ticket_breakdown(day_id):
    store_id = current_store_id()
    result = business_day_service.get_ticket_breakdown_for_day(store_id, day_id)
    return jsonify(result)


@business_day_bp.route("/<int:day_id>/close", methods=["POST"])
@admin_required
def close_day(day_id):
    store_id = current_store_id()
    day = business_day_service.close_business_day(store_id, day_id, current_user_id())
    return jsonify({"business_day": _schema.dump(day)})
