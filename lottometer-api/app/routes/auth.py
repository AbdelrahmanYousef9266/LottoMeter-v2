"""Auth routes — /api/auth/*"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.auth_schema import SetupRequestSchema, LoginRequestSchema
from app.services import auth_service
from app.errors import ValidationError
from app.token_blocklist import add_to_blocklist
from app.models.store import Store
from app.auth_helpers import (
    admin_required,
    current_user_id,
    current_store_id,
    current_role,
)
from app.extensions import limiter


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/setup", methods=["POST"])
def setup():
    """First-run setup — create store + admin + PIN."""
    try:
        data = SetupRequestSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    result = auth_service.setup_first_store(data)
    return jsonify(result), 201


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    """Authenticate user — returns JWT."""
    try:
        data = LoginRequestSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    result = auth_service.login(data)
    return jsonify(result), 200


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """Logout — adds the current token's jti to the blocklist."""
    jti = get_jwt()["jti"]
    add_to_blocklist(jti)
    return "", 204


# --- Test endpoints to verify decorators (remove after auth fully tested) ---

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """Returns the authenticated user + their store info."""
    from app.models.user import User

    user_id = current_user_id()
    store_id = current_store_id()

    user = User.query.filter_by(user_id=user_id, store_id=store_id).first()
    store = Store.query.filter_by(store_id=store_id).first()

    return jsonify({
        "user_id": user_id,
        "store_id": store_id,
        "role": current_role(),
        "username": user.username if user else None,
        "store": {
            "store_id": store.store_id,
            "store_name": store.store_name,
            "store_code": store.store_code,
            "scan_mode": store.scan_mode,
        } if store else None,
    })


@auth_bp.route("/change-password", methods=["PUT"])
@jwt_required()
def change_password():
    """Change the authenticated user's password."""
    body = request.get_json() or {}
    current_password = body.get("current_password", "")
    new_password = body.get("new_password", "")
    confirm_password = body.get("confirm_password", "")

    if not current_password or not new_password or not confirm_password:
        raise ValidationError("current_password, new_password, and confirm_password are required.")

    auth_service.change_password(
        user_id=current_user_id(),
        store_id=current_store_id(),
        current_password=current_password,
        new_password=new_password,
        confirm_password=confirm_password,
    )
    return jsonify({"message": "Password updated successfully."}), 200


@auth_bp.route("/admin-only", methods=["GET"])
@admin_required
def admin_only():
    """Admin-only endpoint — for verifying admin_required decorator."""
    return jsonify({"message": "You are an admin."})