"""User routes — admin CRUD."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError as MarshmallowValidationError

from app.errors import ValidationError
from app.routes.auth import admin_required, current_store_id
from app.schemas.user import (
    CreateUserSchema,
    UpdateUserSchema,
    serialize_user,
)
from app.services import user_service


user_bp = Blueprint("users", __name__, url_prefix="/api/users")


@user_bp.get("")
@jwt_required()
@admin_required
def list_users_route():
    """GET /api/users — list all non-deleted users in the caller's store."""
    store_id = current_store_id()
    users = user_service.list_users(store_id)
    return jsonify({"users": [serialize_user(u) for u in users]}), 200


@user_bp.get("/active")
@jwt_required()
@admin_required
def list_active_users_route():
    """GET /api/users/active — minimal user list for the employee filter dropdown."""
    store_id = current_store_id()
    users = user_service.list_users(store_id)
    return jsonify({
        "users": [
            {"user_id": u.user_id, "username": u.username, "role": u.role}
            for u in users
        ]
    }), 200


@user_bp.post("")
@jwt_required()
@admin_required
def create_user_route():
    """POST /api/users — admin creates a new user."""
    store_id = current_store_id()
    try:
        data = CreateUserSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid input.", details=err.messages)

    user = user_service.create_user(store_id, data)
    return jsonify({"user": serialize_user(user)}), 201


@user_bp.get("/<int:user_id>")
@jwt_required()
@admin_required
def get_user_route(user_id):
    """GET /api/users/{id} — get one user."""
    store_id = current_store_id()
    user = user_service.get_user(store_id, user_id)
    return jsonify({"user": serialize_user(user)}), 200


@user_bp.put("/<int:user_id>")
@jwt_required()
@admin_required
def update_user_route(user_id):
    """PUT /api/users/{id} — update a user."""
    store_id = current_store_id()
    actor_user_id = int(get_jwt_identity())
    try:
        data = UpdateUserSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid input.", details=err.messages)

    user = user_service.update_user(store_id, user_id, actor_user_id, data)
    return jsonify({"user": serialize_user(user)}), 200


@user_bp.delete("/<int:user_id>")
@jwt_required()
@admin_required
def delete_user_route(user_id):
    """DELETE /api/users/{id} — soft delete."""
    store_id = current_store_id()
    actor_user_id = int(get_jwt_identity())
    user_service.delete_user(store_id, user_id, actor_user_id)
    return "", 204