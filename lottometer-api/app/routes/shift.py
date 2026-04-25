"""Shift routes — /api/shifts/*"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.shift_schema import (
    CloseShiftSchema,
    serialize_main_shift_summary,
    serialize_subshift,
    serialize_pending_scan,
)
from app.schemas.void_schema import VoidShiftSchema
from app.services import shift_service
from app.errors import ValidationError
from app.auth_helpers import admin_required, current_store_id, current_user_id
from app.models.user import User
from app.models.slot import Slot


shift_bp = Blueprint("shift", __name__, url_prefix="/api/shifts")


def _user(user_id):
    if user_id is None:
        return None
    return User.query.filter_by(user_id=user_id).first()


def _slot_name_map_for_books(books):
    slot_ids = {b.slot_id for b in books if b.slot_id is not None}
    if not slot_ids:
        return {}
    return {
        s.slot_id: s.slot_name
        for s in Slot.query.filter(Slot.slot_id.in_(slot_ids)).all()
    }


@shift_bp.route("", methods=["POST"])
@jwt_required()
def open_shift():
    """Open a new main shift (auto-creates Sub-shift 1)."""
    main, sub = shift_service.open_main_shift(
        store_id=current_store_id(), user_id=current_user_id()
    )

    pending_books = shift_service.get_pending_scans_for_subshift(
        current_store_id(), sub.shift_id
    )
    slot_names = _slot_name_map_for_books(pending_books)

    return jsonify({
        "main_shift": {
            "shift_id": main.shift_id,
            "shift_start_time": main.shift_start_time.isoformat() + "Z",
            "is_shift_open": main.is_shift_open,
            "opened_by": {
                "user_id": _user(main.opened_by_user_id).user_id,
                "username": _user(main.opened_by_user_id).username,
            },
        },
        "current_subshift": {
            **serialize_subshift(
                sub, opened_by=_user(sub.opened_by_user_id)
            ),
            "pending_scans": [
                serialize_pending_scan(b, slot_names.get(b.slot_id))
                for b in pending_books
            ],
            "is_initialized": len(pending_books) == 0,
        },
    }), 201


@shift_bp.route("", methods=["GET"])
@jwt_required()
def list_shifts():
    status = request.args.get("status")
    try:
        limit = int(request.args.get("limit", 50))
        offset = int(request.args.get("offset", 0))
    except ValueError:
        raise ValidationError("limit and offset must be integers.")

    shifts, total = shift_service.list_main_shifts(
        store_id=current_store_id(), status=status, limit=limit, offset=offset
    )

    user_ids = {s.opened_by_user_id for s in shifts}
    users = {u.user_id: u for u in User.query.filter(User.user_id.in_(user_ids)).all()}

    return jsonify({
        "shifts": [
            serialize_main_shift_summary(s, opened_by=users.get(s.opened_by_user_id))
            for s in shifts
        ],
        "total": total,
    }), 200


@shift_bp.route("/<int:shift_id>", methods=["GET"])
@jwt_required()
def get_shift(shift_id):
    main = shift_service.get_main_shift(current_store_id(), shift_id)
    subs = shift_service._get_subshifts_for(main.shift_id)

    user_ids = {main.opened_by_user_id, main.closed_by_user_id}
    for s in subs:
        user_ids.add(s.opened_by_user_id)
        if s.closed_by_user_id:
            user_ids.add(s.closed_by_user_id)
    user_ids.discard(None)
    users = {u.user_id: u for u in User.query.filter(User.user_id.in_(user_ids)).all()}

    # If there's a currently-open sub-shift, include its pending scans
    open_sub = next((s for s in subs if s.is_shift_open and not s.voided), None)
    pending_payload = None
    if open_sub is not None:
        pending_books = shift_service.get_pending_scans_for_subshift(
            current_store_id(), open_sub.shift_id
        )
        slot_names = _slot_name_map_for_books(pending_books)
        pending_payload = {
            "shift_id": open_sub.shift_id,
            "pending_scans": [
                serialize_pending_scan(b, slot_names.get(b.slot_id))
                for b in pending_books
            ],
            "is_initialized": len(pending_books) == 0,
        }

    return jsonify({
        "main_shift": serialize_main_shift_summary(
            main, opened_by=users.get(main.opened_by_user_id)
        ),
        "subshifts": [
            serialize_subshift(
                s,
                opened_by=users.get(s.opened_by_user_id),
                closed_by=users.get(s.closed_by_user_id),
            )
            for s in subs
        ],
        "current_subshift_pending": pending_payload,
    }), 200


@shift_bp.route("/<int:shift_id>/close", methods=["PUT"])
@jwt_required()
def close_shift(shift_id):
    """Close the final sub-shift and the main shift."""
    try:
        data = CloseShiftSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    main = shift_service.close_main_shift(
        store_id=current_store_id(),
        main_shift_id=shift_id,
        user_id=current_user_id(),
        cash_in_hand=data["cash_in_hand"],
        gross_sales=data["gross_sales"],
        cash_out=data["cash_out"],
    )

    subs = shift_service._get_subshifts_for(main.shift_id)
    user_ids = {main.opened_by_user_id, main.closed_by_user_id}
    for s in subs:
        user_ids.add(s.opened_by_user_id)
        if s.closed_by_user_id:
            user_ids.add(s.closed_by_user_id)
    user_ids.discard(None)
    users = {u.user_id: u for u in User.query.filter(User.user_id.in_(user_ids)).all()}

    return jsonify({
        "main_shift": serialize_main_shift_summary(
            main, opened_by=users.get(main.opened_by_user_id)
        ),
        "subshifts": [
            serialize_subshift(
                s,
                opened_by=users.get(s.opened_by_user_id),
                closed_by=users.get(s.closed_by_user_id),
            )
            for s in subs
        ],
    }), 200


@shift_bp.route("/<int:shift_id>/subshifts", methods=["POST"])
@jwt_required()
def handover_subshift(shift_id):
    """Close current sub-shift, open the next one (handover)."""
    try:
        data = CloseShiftSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    closed_sub, new_sub, pending_books, carried_count = shift_service.handover_subshift(
        store_id=current_store_id(),
        main_shift_id=shift_id,
        user_id=current_user_id(),
        cash_in_hand=data["cash_in_hand"],
        gross_sales=data["gross_sales"],
        cash_out=data["cash_out"],
    )

    user_ids = {
        closed_sub.opened_by_user_id, closed_sub.closed_by_user_id,
        new_sub.opened_by_user_id,
    }
    user_ids.discard(None)
    users = {u.user_id: u for u in User.query.filter(User.user_id.in_(user_ids)).all()}

    slot_names = _slot_name_map_for_books(pending_books)

    return jsonify({
        "closed_subshift": serialize_subshift(
            closed_sub,
            opened_by=users.get(closed_sub.opened_by_user_id),
            closed_by=users.get(closed_sub.closed_by_user_id),
        ),
        "new_subshift": {
            **serialize_subshift(
                new_sub, opened_by=users.get(new_sub.opened_by_user_id)
            ),
            "carried_forward_count": carried_count,
            "pending_scans": [
                serialize_pending_scan(b, slot_names.get(b.slot_id))
                for b in pending_books
            ],
            "is_initialized": len(pending_books) == 0,
        },
    }), 200


@shift_bp.route("/<int:shift_id>/void", methods=["POST"])
@admin_required
def void_main_shift(shift_id):
    """Admin-only: void a main shift (cascades to all sub-shifts)."""
    try:
        data = VoidShiftSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    main = shift_service.void_main_shift(
        store_id=current_store_id(),
        main_shift_id=shift_id,
        user_id=current_user_id(),
        reason=data["reason"],
    )

    user_ids = {main.opened_by_user_id, main.voided_by_user_id}
    user_ids.discard(None)
    users = {u.user_id: u for u in User.query.filter(User.user_id.in_(user_ids)).all()}

    return jsonify({
        "main_shift": {
            **serialize_main_shift_summary(
                main, opened_by=users.get(main.opened_by_user_id)
            ),
            "void_reason": main.void_reason,
            "voided_at": main.voided_at.isoformat() + "Z" if main.voided_at else None,
            "voided_by": (
                {
                    "user_id": main.voided_by_user_id,
                    "username": users.get(main.voided_by_user_id).username
                    if users.get(main.voided_by_user_id) else None,
                }
                if main.voided_by_user_id else None
            ),
        }
    }), 200


@shift_bp.route("/<int:shift_id>/subshifts/<int:subshift_id>/void", methods=["POST"])
@admin_required
def void_subshift(shift_id, subshift_id):
    """Admin-only: void a single sub-shift."""
    try:
        data = VoidShiftSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    sub = shift_service.void_subshift(
        store_id=current_store_id(),
        main_shift_id=shift_id,
        subshift_id=subshift_id,
        user_id=current_user_id(),
        reason=data["reason"],
    )

    user_ids = {
        sub.opened_by_user_id,
        sub.closed_by_user_id,
        sub.voided_by_user_id,
    }
    user_ids.discard(None)
    users = {u.user_id: u for u in User.query.filter(User.user_id.in_(user_ids)).all()}

    return jsonify({
        "subshift": {
            **serialize_subshift(
                sub,
                opened_by=users.get(sub.opened_by_user_id),
                closed_by=users.get(sub.closed_by_user_id),
            ),
            "void_reason": sub.void_reason,
            "voided_at": sub.voided_at.isoformat() + "Z" if sub.voided_at else None,
            "voided_by": (
                {
                    "user_id": sub.voided_by_user_id,
                    "username": users.get(sub.voided_by_user_id).username
                    if users.get(sub.voided_by_user_id) else None,
                }
                if sub.voided_by_user_id else None
            ),
        }
    }), 200