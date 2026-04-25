"""Whole-book-sale Marshmallow schemas."""

from decimal import Decimal
from marshmallow import Schema, fields, validate, validates, ValidationError as MmValidationError

from app.constants import ALLOWED_TICKET_PRICES


class WholeBookSaleSchema(Schema):
    """Validates POST /api/shifts/{id}/whole-book-sale."""

    barcode = fields.Str(required=True, validate=validate.Length(min=4, max=100))
    ticket_price = fields.Str(required=True)
    pin = fields.Str(
        required=True,
        validate=validate.Regexp(r"^\d{4}$", error="PIN must be exactly 4 digits."),
    )
    note = fields.Str(allow_none=True, load_default=None, validate=validate.Length(max=500))

    @validates("ticket_price")
    def _check_price(self, value, **kwargs):
        try:
            d = Decimal(str(value)).quantize(Decimal("0.01"))
        except Exception:
            raise MmValidationError("Invalid ticket_price format.")
        if d not in ALLOWED_TICKET_PRICES:
            raise MmValidationError(
                "ticket_price must be one of: 1.00, 2.00, 3.00, 5.00, 10.00, 20.00."
            )


def serialize_extra_sale(sale, *, created_by_username: str | None = None) -> dict:
    return {
        "extra_sale_id": sale.extra_sale_id,
        "shift_id": sale.shift_id,
        "sale_type": sale.sale_type,
        "scanned_barcode": sale.scanned_barcode,
        "ticket_price": str(sale.ticket_price),
        "ticket_count": sale.ticket_count,
        "value": str(sale.value),
        "note": sale.note,
        "created_at": sale.created_at.isoformat() + "Z",
        "created_by": (
            {"user_id": sale.created_by_user_id, "username": created_by_username}
            if created_by_username
            else {"user_id": sale.created_by_user_id}
        ),
    }