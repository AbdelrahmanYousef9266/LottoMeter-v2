"""Slot routes — /api/slots/*"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.slot_schema import SlotCreateSchema, SlotUpdateSchema, serialize_slot
from app.services import slot_service
from app.errors import ValidationError
from app.auth_helpers import admin_required, current_store_id


slot_bp = Blueprint("slot", __name__, url_prefix="/api/slots")


@slot_bp.route("", methods=["GET"])
@jwt_required()
def list_slots():
    """List all non-deleted slots in the store."""
    slots = slot_service.list_slots(current_store_id())
    return jsonify({"slots": [serialize_slot(s) for s in slots]}), 200


@slot_bp.route("", methods=["POST"])
@admin_required
def create_slot():
    """Admin-only: create a new slot."""
    try:
        data = SlotCreateSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    slot = slot_service.create_slot(
        store_id=current_store_id(),
        slot_name=data["slot_name"],
        ticket_price=data["ticket_price"],
    )
    return jsonify(serialize_slot(slot)), 201


@slot_bp.route("/<int:slot_id>", methods=["GET"])
@jwt_required()
def get_slot(slot_id):
    """Get a single slot by id."""
    slot = slot_service.get_slot(current_store_id(), slot_id)
    return jsonify(serialize_slot(slot)), 200


@slot_bp.route("/<int:slot_id>", methods=["PUT"])
@admin_required
def update_slot(slot_id):
    """Admin-only: update slot name and/or ticket price."""
    try:
        data = SlotUpdateSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    slot = slot_service.update_slot(
        store_id=current_store_id(),
        slot_id=slot_id,
        slot_name=data.get("slot_name"),
        ticket_price=data.get("ticket_price"),
    )
    return jsonify(serialize_slot(slot)), 200


@slot_bp.route("/<int:slot_id>", methods=["DELETE"])
@admin_required
def delete_slot(slot_id):
    """Admin-only: soft-delete a slot."""
    slot_service.soft_delete_slot(current_store_id(), slot_id)
    return "", 204