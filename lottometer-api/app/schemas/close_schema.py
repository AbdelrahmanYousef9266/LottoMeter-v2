"""Shift Marshmallow schemas — validation + serialization."""

from decimal import Decimal
from marshmallow import Schema, fields, validates, validate, ValidationError as MmValidationError


def _validate_positive_decimal(value, field_name: str):
    try:
        d = Decimal(str(value))
    except Exception:
        raise MmValidationError(f"{field_name} must be a valid decimal.")
    if d < 0:
        raise MmValidationError(f"{field_name} cannot be negative.")
    return d


class CloseShiftSchema(Schema):
    """Validates close payload for sub-shift / main shift close."""

    cash_in_hand = fields.Str(required=True)
    gross_sales = fields.Str(required=True)
    cash_out = fields.Str(required=True)
    cancels = fields.Decimal(required=False, load_default=Decimal("0"), validate=validate.Range(min=0))

    @validates("cash_in_hand")
    def _v_cash(self, v, **kwargs):
        _validate_positive_decimal(v, "cash_in_hand")

    @validates("gross_sales")
    def _v_gross(self, v, **kwargs):
        _validate_positive_decimal(v, "gross_sales")

    @validates("cash_out")
    def _v_cashout(self, v, **kwargs):
        _validate_positive_decimal(v, "cash_out")


def _user_summary(user):
    return {"user_id": user.user_id, "username": user.username} if user else None


def serialize_main_shift_summary(main, *, opened_by=None) -> dict:
    """Compact summary for list views."""
    return {
        "shift_id": main.shift_id,
        "shift_start_time": main.shift_start_time.isoformat() + "Z",
        "shift_end_time": main.shift_end_time.isoformat() + "Z" if main.shift_end_time else None,
        "is_shift_open": main.is_shift_open,
        "voided": main.voided,
        "tickets_total": str(main.tickets_total) if main.tickets_total is not None else None,
        "difference": str(main.difference) if main.difference is not None else None,
        "shift_status": main.shift_status,
        "opened_by": _user_summary(opened_by),
    }


def serialize_subshift(sub, *, opened_by=None, closed_by=None) -> dict:
    return {
        "shift_id": sub.shift_id,
        "main_shift_id": sub.main_shift_id,
        "shift_number": sub.shift_number,
        "shift_start_time": sub.shift_start_time.isoformat() + "Z",
        "shift_end_time": sub.shift_end_time.isoformat() + "Z" if sub.shift_end_time else None,
        "is_shift_open": sub.is_shift_open,
        "voided": sub.voided,
        "cash_in_hand": str(sub.cash_in_hand) if sub.cash_in_hand is not None else None,
        "gross_sales": str(sub.gross_sales) if sub.gross_sales is not None else None,
        "cash_out": str(sub.cash_out) if sub.cash_out is not None else None,
        "tickets_total": str(sub.tickets_total) if sub.tickets_total is not None else None,
        "expected_cash": str(sub.expected_cash) if sub.expected_cash is not None else None,
        "difference": str(sub.difference) if sub.difference is not None else None,
        "shift_status": sub.shift_status,
        "opened_by": _user_summary(opened_by),
        "closed_by": _user_summary(closed_by),
    }


def serialize_pending_scan(book, slot_name: str | None) -> dict:
    return {
        "slot_id": book.slot_id,
        "slot_name": slot_name,
        "book_id": book.book_id,
        "static_code": book.static_code,
        "ticket_price": str(book.ticket_price) if book.ticket_price is not None else None,
        "book_name": book.book_name,
    }