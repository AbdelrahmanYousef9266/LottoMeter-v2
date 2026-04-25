"""Auth routes — /api/auth/*"""

from flask import Blueprint, request, jsonify
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.auth_schema import SetupRequestSchema, LoginRequestSchema
from app.services import auth_service
from app.errors import ValidationError


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