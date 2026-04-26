"""Slot Marshmallow schemas — validation + serialization."""

from decimal import Decimal
from marshmallow import Schema, fields, validate, validates, ValidationError as MmValidationError

from app.constants import ALLOWED_TICKET_PRICES


def _validate_ticket_price(value):
    """Accepts string or number; checks against ALLOWED_TICKET_PRICES."""
    try:
        d = Decimal(str(value)).quantize(Decimal("0.01"))
    except Exception:
        raise MmValidationError("Invalid ticket price format.")
    if d not in ALLOWED_TICKET_PRICES:
        raise MmValidationError(
            f"ticket_price must be one of: 1.00, 2.00, 3.00, 5.00, 10.00, 20.00."
        )


class SlotCreateSchema(Schema):
    slot_name = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    ticket_price = fields.Str(required=True)

    @validates("ticket_price")
    def _check_price(self, value, **kwargs):
        _validate_ticket_price(value)


class SlotUpdateSchema(Schema):
    slot_name = fields.Str(validate=validate.Length(min=1, max=100))
    ticket_price = fields.Str()

    @validates("ticket_price")
    def _check_price(self, value, **kwargs):
        _validate_ticket_price(value)


def _current_book_for_slot(slot) -> dict | None:
    """Find the active book in this slot, if any. Returns a dict or None."""
    from app.models.book import Book

    book = (
        Book.query
        .filter_by(slot_id=slot.slot_id, store_id=slot.store_id, is_active=True)
        .first()
    )
    if book is None:
        return None
    return {
        "book_id": book.book_id,
        "static_code": book.static_code,
        "barcode": book.barcode,
        "start_position": book.start_position,
        "book_name": book.book_name,
        "ticket_price": str(book.ticket_price) if book.ticket_price is not None else None,
    }


def serialize_slot(slot) -> dict:
    """Serialize a Slot to dict matching API Contract §3."""
    return {
        "slot_id": slot.slot_id,
        "slot_name": slot.slot_name,
        "ticket_price": str(slot.ticket_price),
        "current_book": _current_book_for_slot(slot),
    }