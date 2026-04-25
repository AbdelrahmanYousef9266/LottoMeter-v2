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


def serialize_slot(slot) -> dict:
    """Serialize a Slot to dict matching API Contract §3."""
    return {
        "slot_id": slot.slot_id,
        "slot_name": slot.slot_name,
        "ticket_price": str(slot.ticket_price),
        "current_book": None,  # populated when Book model exists
    }