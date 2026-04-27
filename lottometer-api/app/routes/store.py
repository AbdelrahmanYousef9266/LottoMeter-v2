"""Store routes — /api/store/*"""

from flask import Blueprint, request, jsonify
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.store_schema import ChangePinSchema, ChangeScanModeSchema
from app.services import store_service
from app.errors import ValidationError
from app.auth_helpers import admin_required, current_store_id


store_bp = Blueprint("store", __name__, url_prefix="/api/store")


@store_bp.route("/settings/pin", methods=["PUT"])
@admin_required
def change_pin():
    """Admin-only: change the store's 4-digit PIN."""
    try:
        data = ChangePinSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    result = store_service.change_pin(
        store_id=current_store_id(),
        current_pin=data["current_pin"],
        new_pin=data["new_pin"],
    )
    return jsonify(result), 200

@store_bp.route("/settings/scan-mode", methods=["PUT"])
@admin_required
def change_scan_mode():
    """Admin-only: change the store's scan mode."""
    try:
        data = ChangeScanModeSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    result = store_service.change_scan_mode(
        store_id=current_store_id(),
        scan_mode=data["scan_mode"],
    )
    return jsonify(result), 200