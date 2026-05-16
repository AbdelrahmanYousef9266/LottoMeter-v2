"""Store routes — /api/store/*"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.store_schema import ChangePinSchema, ChangeScanModeSchema, SetStorePinSchema, VerifyStorePinSchema
from app.services import store_service
from app.services.store_settings_service import get_settings, update_settings, serialize_settings
from app.errors import ValidationError
from app.auth_helpers import admin_required, blocks_impersonation, current_store_id


store_bp = Blueprint("store", __name__, url_prefix="/api/store")


@store_bp.route("/pin", methods=["PUT"])
@admin_required
@blocks_impersonation
def set_store_pin():
    """Admin-only: set (or reset) the store PIN without requiring the old PIN."""
    try:
        data = SetStorePinSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    result = store_service.set_store_pin(
        store_id=current_store_id(),
        pin=data["pin"],
        confirm_pin=data["confirm_pin"],
    )
    return jsonify(result), 200


@store_bp.route("/verify-pin", methods=["POST"])
@jwt_required()
def verify_store_pin():
    """Any authenticated user: verify the store PIN."""
    try:
        data = VerifyStorePinSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    store_service.verify_store_pin(current_store_id(), data["pin"])
    return jsonify({"valid": True}), 200


@store_bp.route("/settings/pin", methods=["PUT"])
@admin_required
@blocks_impersonation
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


@store_bp.route("/settings", methods=["GET"])
@jwt_required()
def get_store_settings():
    """Any authenticated user: retrieve store settings."""
    settings = get_settings(current_store_id())
    return jsonify({"settings": serialize_settings(settings)}), 200


@store_bp.route("/settings", methods=["PUT"])
@admin_required
def update_store_settings():
    """Admin-only: update store settings."""
    body = request.get_json(silent=True) or {}
    settings = update_settings(current_store_id(), body)
    return jsonify({"settings": serialize_settings(settings)}), 200


@store_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_store_profile():
    """Any authenticated user: retrieve store profile fields."""
    from app.models.store import Store
    store = Store.query.filter_by(store_id=current_store_id()).first()
    if store is None:
        from app.errors import NotFoundError
        raise NotFoundError("Store not found.", code="STORE_NOT_FOUND")
    return jsonify({
        "store_name": store.store_name,
        "store_code": store.store_code,
        "owner_name": store.owner_name,
        "email":      store.email,
        "phone":      store.phone,
        "address":    store.address,
        "city":       store.city,
        "state":      store.state,
        "zip_code":   store.zip_code,
    }), 200


@store_bp.route("/profile", methods=["PUT"])
@admin_required
def update_store_profile():
    """Admin-only: update store profile (name, owner, contact, address)."""
    body = request.get_json(silent=True) or {}
    result = store_service.update_profile(current_store_id(), body)
    return jsonify({"store": result}), 200