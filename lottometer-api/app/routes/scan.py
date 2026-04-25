"""Scan route — POST /api/scan."""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.scan_schema import ScanRequestSchema, serialize_scan
from app.schemas.book_schema import serialize_book
from app.services import scan_service
from app.errors import ValidationError
from app.auth_helpers import current_store_id, current_user_id


scan_bp = Blueprint("scan", __name__, url_prefix="/api")


@scan_bp.route("/scan", methods=["POST"])
@jwt_required()
def scan():
    """Record a scan during an open sub-shift."""
    try:
        data = ScanRequestSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    scan_row, book, sub = scan_service.record_scan(
        store_id=current_store_id(),
        user_id=current_user_id(),
        shift_id=data["shift_id"],
        barcode=data["barcode"],
        scan_type=data["scan_type"],
    )

    totals = scan_service.get_running_totals(sub.shift_id)
    pending_remaining = scan_service.pending_scans_remaining(
        current_store_id(), sub.shift_id
    )

    return jsonify({
        "book": {
            "book_id": book.book_id,
            "static_code": book.static_code,
            "ticket_price": str(book.ticket_price) if book.ticket_price is not None else None,
            "is_sold": book.is_sold,
            "is_active": book.is_active,
        },
        "scan": serialize_scan(scan_row),
        "running_totals": totals,
        "pending_scans_remaining": pending_remaining,
        "is_initialized": pending_remaining == 0,
    }), 200