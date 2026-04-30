"""Whole-book-sale service — PIN-protected."""

from decimal import Decimal

from app.extensions import db
from app.models.shift_extra_sales import ShiftExtraSales
from app.models.employee_shift import EmployeeShift
from app.constants import LENGTH_BY_PRICE
from app.errors import NotFoundError, BusinessRuleError


def create_whole_book_sale(
    store_id: int,
    user_id: int,
    subshift_id: int,
    barcode: str,
    ticket_price: str,
    pin: str,
    note: str | None,
) -> ShiftExtraSales:
    """Record a whole-book sale on the given open sub-shift.

    - Verifies sub-shift is open + non-voided + in this store
    - Verifies PIN with rate-limiting
    - Creates ShiftExtraSales row (no Book row)
    """
    from app.services import auth_service  # late import to avoid circular

    shift = (
        EmployeeShift.query
        .filter_by(id=subshift_id, store_id=store_id)
        .first()
    )
    if shift is None:
        raise NotFoundError(
            "Sub-shift not found.",
            code="SUBSHIFT_NOT_FOUND",
        )
    if shift.voided:
        raise BusinessRuleError("Sub-shift has been voided.", code="SHIFT_VOIDED")
    if shift.status != "open":
        raise BusinessRuleError("Sub-shift is closed.", code="SHIFT_CLOSED")

    # Verify PIN (raises on failure or lockout)
    auth_service.verify_store_pin(store_id, user_id, pin)

    price = Decimal(ticket_price).quantize(Decimal("0.01"))
    ticket_count = LENGTH_BY_PRICE[price]
    value = price * ticket_count

    sale = ShiftExtraSales(
        shift_id=subshift_id,
        sale_type="whole_book",
        scanned_barcode=barcode,
        ticket_price=price,
        ticket_count=ticket_count,
        value=value,
        note=note,
        created_by_user_id=user_id,
        store_id=store_id,
    )
    db.session.add(sale)
    db.session.commit()
    return sale