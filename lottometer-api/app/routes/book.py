"""Book routes — /api/books and /api/slots/{id}/assign-book."""

from datetime import datetime, timezone

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from marshmallow import ValidationError as MarshmallowValidationError

from app.schemas.book_schema import (
    AssignBookSchema,
    ReturnToVendorSchema,
    serialize_book,
    serialize_assignment_event,
)
from app.schemas.slot_schema import serialize_slot
from app.services import book_service
from app.services.audit_service import log_action
from app.errors import ValidationError, NotFoundError
from app.auth_helpers import admin_required, current_store_id, current_user_id
from app.models.book import Book
from app.models.book_assignment_history import BookAssignmentHistory
from app.models.slot import Slot
from app.models.user import User
from app.extensions import db


book_bp = Blueprint("book", __name__, url_prefix="/api")


def _str_to_bool(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    return str(v).lower() in ("true", "1", "yes")


@book_bp.route("/books", methods=["GET"])
@jwt_required()
def list_books():
    is_active = _str_to_bool(request.args.get("is_active"))
    is_sold = _str_to_bool(request.args.get("is_sold"))
    returned = _str_to_bool(request.args.get("returned"))
    books = book_service.list_books(
        current_store_id(), is_active=is_active, is_sold=is_sold, returned=returned
    )

    # Look up slot names for serialization
    slot_ids = {b.slot_id for b in books if b.slot_id is not None}
    slots = {
        s.slot_id: s.slot_name
        for s in Slot.query.filter(Slot.slot_id.in_(slot_ids)).all()
    }

    out = []
    for b in books:
        d = serialize_book(b)
        d["slot_name"] = slots.get(b.slot_id)
        out.append(d)
    return jsonify({"books": out}), 200


@book_bp.route("/books/summary", methods=["GET"])
@jwt_required()
def get_books_summary():
    """Any authenticated user: aggregate counts of books in the store."""
    summary = book_service.get_books_summary(current_store_id())
    return jsonify(summary), 200


@book_bp.route("/books/activity", methods=["GET"])
@admin_required
def get_books_activity():
    """Admin-only: rolling time-windowed sold/returned counts with previous-period comparison."""
    period = request.args.get("period", "week")
    activity = book_service.get_books_activity(current_store_id(), period)
    return jsonify(activity), 200


@book_bp.route("/books/<int:book_id>", methods=["GET"])
@jwt_required()
def get_book(book_id):
    book = book_service.get_book(current_store_id(), book_id)
    history = book_service.get_assignment_history(book)

    # Look up slot names + usernames for the history
    slot_ids = {h.slot_id for h in history}
    slots = {
        s.slot_id: s.slot_name
        for s in Slot.query.filter(Slot.slot_id.in_(slot_ids)).all()
    }
    user_ids = {h.assigned_by_user_id for h in history}
    users = {
        u.user_id: u.username
        for u in User.query.filter(User.user_id.in_(user_ids)).all()
    }

    return jsonify({
        "book": serialize_book(book),
        "assignment_history": [
            serialize_assignment_event(
                h, slot_name=slots.get(h.slot_id), assigned_by_username=users.get(h.assigned_by_user_id)
            )
            for h in history
        ],
    }), 200


@book_bp.route("/slots/<int:slot_id>/assign-book", methods=["POST"])
@admin_required
def assign_book(slot_id):
    """Admin-only: scan-to-assign a book to a slot."""
    try:
        data = AssignBookSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    store_id = current_store_id()
    user_id = current_user_id()
    book, slot = book_service.assign_book_to_slot(
        store_id=store_id,
        slot_id=slot_id,
        user_id=user_id,
        barcode=data["barcode"],
        book_name=data.get("book_name"),
        ticket_price_override=data.get("ticket_price_override"),
        confirm_reassign=data.get("confirm_reassign", False),
    )

    next_slot = book_service.find_next_empty_slot(store_id)
    log_action("book_assigned", user_id=user_id, store_id=store_id,
               entity_type="book", entity_id=book.book_id,
               new_value=f"slot_id={slot_id} barcode={data['barcode']}",
               ip_address=request.remote_addr,
               user_agent=(request.headers.get("User-Agent") or "")[:200])
    return jsonify({
        "book": serialize_book(book),
        "slot": serialize_slot(slot),
        "next_empty_slot": serialize_slot(next_slot) if next_slot else None,
    }), 201


@book_bp.route("/books/<int:book_id>/unassign", methods=["POST"])
@admin_required
def unassign_book(book_id):
    """Admin-only: remove a book from its slot, preserve Book row."""
    book = book_service.unassign_book(
        store_id=current_store_id(),
        book_id=book_id,
        user_id=current_user_id(),
    )
    return jsonify({"book": serialize_book(book)}), 200



@book_bp.route("/books/<int:book_id>/return-to-vendor", methods=["POST"])
@jwt_required()
def return_to_vendor(book_id):
    """Any authenticated user (PIN-protected): return book to lottery vendor."""
    try:
        data = ReturnToVendorSchema().load(request.get_json() or {})
    except MarshmallowValidationError as err:
        raise ValidationError("Invalid request body.", details=err.messages)

    store_id = current_store_id()
    user_id = current_user_id()
    book, position, close_scan_recorded = book_service.return_to_vendor(
        store_id=store_id,
        book_id=book_id,
        user_id=user_id,
        barcode=data["barcode"],
        pin=data["pin"],
    )
    log_action("book_returned", user_id=user_id, store_id=store_id,
               entity_type="book", entity_id=book.book_id,
               new_value=f"position={position}",
               ip_address=request.remote_addr,
               user_agent=(request.headers.get("User-Agent") or "")[:200])
    return jsonify({
        "book": serialize_book(book),
        "close_scan_recorded": close_scan_recorded,
        "position": position,
    }), 200


@book_bp.route("/books/<int:book_id>/mark-sold", methods=["POST"])
@admin_required
def mark_book_sold(book_id):
    """Admin-only: manually mark a book as sold and vacate its slot."""
    store_id = current_store_id()
    user_id = current_user_id()

    book = Book.query.filter_by(book_id=book_id, store_id=store_id).first()
    if book is None:
        raise NotFoundError("Book not found.", code="BOOK_NOT_FOUND")

    now = datetime.now(timezone.utc)
    book.is_sold = True
    book.sold_at = now
    book.is_active = False
    book.slot_id = None

    history = (
        BookAssignmentHistory.query
        .filter_by(book_id=book.book_id, unassigned_at=None)
        .order_by(BookAssignmentHistory.assigned_at.desc())
        .first()
    )
    if history is not None:
        history.unassigned_at = now
        history.unassigned_by_user_id = user_id
        history.unassign_reason = "sold"

    db.session.commit()

    log_action("book_mark_sold", user_id=user_id, store_id=store_id,
               entity_type="book", entity_id=book.book_id,
               new_value="is_sold=True",
               ip_address=request.remote_addr,
               user_agent=(request.headers.get("User-Agent") or "")[:200])

    return jsonify({
        "message": "Book marked as sold successfully.",
        "book": serialize_book(book),
    }), 200