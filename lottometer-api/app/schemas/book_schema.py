"""Book Marshmallow schemas — validation + serialization."""

from marshmallow import Schema, fields, validate, validates, ValidationError as MmValidationError
from decimal import Decimal

from app.constants import ALLOWED_TICKET_PRICES, LENGTH_BY_PRICE


class AssignBookSchema(Schema):
    """Validates POST /api/slots/{id}/assign-book request body."""

    barcode = fields.Str(required=True, validate=validate.Length(min=4, max=100))
    book_name = fields.Str(allow_none=True, load_default=None, validate=validate.Length(max=150))
    ticket_price_override = fields.Str(allow_none=True, load_default=None)
    confirm_reassign = fields.Bool(load_default=False)

    @validates("ticket_price_override")
    def _check_price(self, value, **kwargs):
        if value is None:
            return
        try:
            d = Decimal(str(value)).quantize(Decimal("0.01"))
        except Exception:
            raise MmValidationError("Invalid ticket_price_override format.")
        if d not in ALLOWED_TICKET_PRICES:
            raise MmValidationError(
                "ticket_price_override must be one of: 1.00, 2.00, 3.00, 5.00, 10.00, 20.00."
            )


def serialize_book(book) -> dict:
    """Serialize a Book to dict matching API Contract §4."""
    book_length = (
        LENGTH_BY_PRICE[book.ticket_price] if book.ticket_price is not None else None
    )
    return {
        "book_id": book.book_id,
        "book_name": book.book_name,
        "barcode": book.barcode,
        "static_code": book.static_code,
        "start_position": book.start_position,
        "ticket_price": str(book.ticket_price) if book.ticket_price is not None else None,
        "book_length": book_length,
        "slot_id": book.slot_id,
        "is_active": book.is_active,
        "is_sold": book.is_sold,
        "returned_at": book.returned_at.isoformat() + "Z" if book.returned_at else None,
    }


def serialize_assignment_event(event, slot_name: str = None, assigned_by_username: str = None) -> dict:
    """Serialize a BookAssignmentHistory row."""
    return {
        "assignment_id": event.assignment_id,
        "slot_id": event.slot_id,
        "slot_name": slot_name,
        "ticket_price": str(event.ticket_price),
        "assigned_at": event.assigned_at.isoformat() + "Z",
        "unassigned_at": event.unassigned_at.isoformat() + "Z" if event.unassigned_at else None,
        "assigned_by": (
            {"user_id": event.assigned_by_user_id, "username": assigned_by_username}
            if assigned_by_username
            else {"user_id": event.assigned_by_user_id}
        ),
        "unassign_reason": event.unassign_reason,
    }