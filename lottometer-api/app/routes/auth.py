"""Auth routes — /api/auth/*"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.auth_schema import SetupRequestSchema, LoginRequestSchema
from app.services import auth_service
from app.errors import ValidationError
from app.token_blocklist import add_to_blocklist
from app.auth_helpers import (
    admin_required,
    current_user_id,
    current_store_id,
    current_role,
)


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
    """Returns the authenticated user's claims — for verifying decorators."""
    return jsonify({
        "user_id": current_user_id(),
        "store_id": current_store_id(),
        "role": current_role(),
    })


@auth_bp.route("/admin-only", methods=["GET"])
@admin_required
def admin_only():
    """Admin-only endpoint — for verifying admin_required decorator."""
    return jsonify({"message": "You are an admin."})