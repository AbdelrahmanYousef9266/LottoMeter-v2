"""EmployeeShift service — open, close, void, and carry-forward logic."""

from decimal import Decimal
from datetime import datetime, timezone

from app.extensions import db
from app.models.employee_shift import EmployeeShift
from app.models.shift_books import ShiftBooks
from app.models.shift_extra_sales import ShiftExtraSales
from app.models.book import Book
from app.errors import (
    NotFoundError,
    ConflictError,
    BusinessRuleError,
    ValidationError,
)


# ---------- Internal helpers ----------

def _get_open_employee_shift(store_id: int) -> EmployeeShift | None:
    """The currently open, non-voided EmployeeShift for this store, or None."""
    return (
        EmployeeShift.query
        .filter_by(store_id=store_id, status="open", voided=False)
        .first()
    )


def _all_active_books(store_id: int) -> list[Book]:
    return (
        Book.query
        .filter_by(store_id=store_id, is_active=True, is_sold=False)
        .order_by(Book.book_id)
        .all()
    )


def _compute_shift_tickets_total(shift_id: int, store_id: int) -> Decimal:
    """Sum of ticket sales across open/close scan pairs plus whole-book extras.

    Mirrors _compute_subshift_tickets_total in shift_service.py; operates on
    employee_shifts.id instead of shift_details.shift_id.
    """
    total = Decimal("0")

    open_scans = {
        s.static_code: s for s in
        ShiftBooks.query
        .filter_by(shift_id=shift_id, store_id=store_id, scan_type="open")
        .all()
    }
    close_scans = {
        s.static_code: s for s in
        ShiftBooks.query
        .filter_by(shift_id=shift_id, store_id=store_id, scan_type="close")
        .all()
    }

    for static_code, close in close_scans.items():
        open_scan = open_scans.get(static_code)
        if open_scan is None:
            continue
        book = Book.query.filter_by(store_id=store_id, static_code=static_code).first()
        if book is None or book.ticket_price is None:
            continue
        tickets_sold = close.start_at_scan - open_scan.start_at_scan
        if close.is_last_ticket:
            tickets_sold += 1
        if tickets_sold > 0:
            total += book.ticket_price * tickets_sold

    for extra in ShiftExtraSales.query.filter_by(shift_id=shift_id, store_id=store_id).all():
        total += extra.value

    return total


def _verify_all_active_books_have_close_scan(store_id: int, shift_id: int) -> None:
    """BR-ES-04: every active book must have a close scan before the shift can close."""
    active_books = _all_active_books(store_id)
    if not active_books:
        return

    closed_codes = {
        s.static_code for s in
        ShiftBooks.query
        .filter_by(shift_id=shift_id, store_id=store_id, scan_type="close")
        .all()
    }
    missing = [b for b in active_books if b.static_code not in closed_codes]
    if missing:
        names = [b.book_name or b.static_code for b in missing]
        raise BusinessRuleError(
            f"{len(missing)} active book(s) have no close scan: {', '.join(names)}",
            code="BOOKS_NOT_CLOSED",
            details={"missing_book_ids": [b.book_id for b in missing]},
        )


def _carry_forward_close_scans(
    previous_shift: EmployeeShift,
    new_shift: EmployeeShift,
    store_id: int,
) -> int:
    """Copy previous shift's close scans as open scans on the new shift.

    BR-ES-03: only runs when previous_shift.shift_status == "correct".
    Skips books that are sold or inactive.
    Returns count of rows carried forward.
    """
    close_scans = ShiftBooks.query.filter_by(
        shift_id=previous_shift.id,
        store_id=store_id,
        scan_type="close",
    ).all()

    count = 0
    for scan in close_scans:
        book = Book.query.filter_by(store_id=store_id, static_code=scan.static_code).first()
        if book is None or book.is_sold or not book.is_active:
            continue

        db.session.add(ShiftBooks(
            shift_id=new_shift.id,
            static_code=scan.static_code,
            scan_type="open",
            barcode=book.barcode,
            start_at_scan=scan.start_at_scan,
            is_last_ticket=False,
            scan_source="carried_forward",
            slot_id=scan.slot_id,
            store_id=store_id,
            scanned_at=datetime.now(timezone.utc),
            scanned_by_user_id=new_shift.employee_id,
        ))
        count += 1

    db.session.flush()
    return count


# ---------- Public API ----------

def get_pending_scans_for_shift(
    store_id: int,
    shift: EmployeeShift,
) -> list[Book]:
    """Active books that don't yet have an open scan in this shift."""
    open_codes = {
        s.static_code for s in
        ShiftBooks.query
        .filter_by(shift_id=shift.id, store_id=store_id, scan_type="open")
        .all()
    }
    return [b for b in _all_active_books(store_id) if b.static_code not in open_codes]


def open_employee_shift(
    store_id: int,
    user_id: int,
) -> tuple[EmployeeShift, list[Book], int]:
    """Open a new EmployeeShift, auto-creating today's BusinessDay if needed.

    Returns: (new_shift, pending_books, carried_forward_count)
    """
    from app.services.business_day_service import get_or_create_business_day

    # BR-BD-02: BusinessDay is auto-created, never manually opened
    business_day = get_or_create_business_day(store_id)

    # BR-ES-01: only one open shift per store at a time
    if _get_open_employee_shift(store_id) is not None:
        raise ConflictError(
            "An employee shift is already open for this store. Close it before opening a new one.",
            code="SHIFT_ALREADY_OPEN",
        )

    # BR-ES-02: shift_number resets per BusinessDay, increments within it
    last_shift = (
        EmployeeShift.query
        .filter_by(business_day_id=business_day.id, store_id=store_id)
        .order_by(EmployeeShift.shift_number.desc())
        .first()
    )
    shift_number = (last_shift.shift_number + 1) if last_shift else 1

    new_shift = EmployeeShift(
        business_day_id=business_day.id,
        store_id=store_id,
        employee_id=user_id,
        shift_number=shift_number,
        opened_at=datetime.now(timezone.utc),
        status="open",
    )
    db.session.add(new_shift)
    db.session.flush()  # materialises new_shift.id before carry-forward

    # BR-ES-03: carry forward only when previous shift balanced exactly
    carried_forward_count = 0
    if last_shift and last_shift.shift_status == "correct":
        carried_forward_count = _carry_forward_close_scans(last_shift, new_shift, store_id)

    db.session.commit()

    # Pending books computed after carry-forward so already-carried books are excluded
    pending_books = get_pending_scans_for_shift(store_id, new_shift)
    return new_shift, pending_books, carried_forward_count


def close_employee_shift(
    store_id: int,
    shift_id: int,
    user_id: int,
    cash_in_hand: str,
    gross_sales: str,
    cash_out: str,
) -> EmployeeShift:
    shift = EmployeeShift.query.filter_by(id=shift_id, store_id=store_id).first()
    if shift is None:
        raise NotFoundError("Employee shift not found.", code="SHIFT_NOT_FOUND")
    if shift.voided:
        raise BusinessRuleError("Employee shift is voided.", code="SHIFT_VOIDED")
    if shift.status != "open":
        raise BusinessRuleError("Employee shift is already closed.", code="SHIFT_ALREADY_CLOSED")

    _verify_all_active_books_have_close_scan(store_id, shift.id)

    cash_in  = Decimal(cash_in_hand)
    gross    = Decimal(gross_sales)
    cash_out_d = Decimal(cash_out)

    tickets_total = _compute_shift_tickets_total(shift.id, store_id)
    expected_cash = gross + tickets_total - cash_out_d
    difference    = cash_in - expected_cash

    shift.cash_in_hand      = cash_in
    shift.gross_sales       = gross
    shift.cash_out          = cash_out_d
    shift.tickets_total     = tickets_total
    shift.expected_cash     = expected_cash
    shift.difference        = difference
    shift.shift_status      = "correct" if difference == 0 else ("over" if difference > 0 else "short")
    shift.status            = "closed"
    shift.closed_at         = datetime.now(timezone.utc)
    shift.closed_by_user_id = user_id

    db.session.commit()
    return shift


def get_running_summary(store_id: int, shift_id: int) -> dict:
    """Live preview of what the shift's totals would look like if closed now."""
    shift = EmployeeShift.query.filter_by(id=shift_id, store_id=store_id).first()
    if shift is None:
        raise NotFoundError("Employee shift not found.", code="SHIFT_NOT_FOUND")

    tickets_total = _compute_shift_tickets_total(shift_id, store_id)

    extras = ShiftExtraSales.query.filter_by(shift_id=shift_id, store_id=store_id).all()
    whole_book_total = sum((e.value for e in extras), Decimal("0"))

    active_books = _all_active_books(store_id)
    close_codes = {
        s.static_code for s in
        ShiftBooks.query
        .filter_by(shift_id=shift_id, store_id=store_id, scan_type="close")
        .all()
    }
    books_with_close = sum(1 for b in active_books if b.static_code in close_codes)

    return {
        "tickets_total":      str(tickets_total),
        "whole_book_total":   str(whole_book_total),
        "books_total_active": len(active_books),
        "books_with_close":   books_with_close,
        "books_pending_close": len(active_books) - books_with_close,
    }


def void_employee_shift(
    store_id: int,
    shift_id: int,
    admin_user_id: int,
    reason: str,
) -> EmployeeShift:
    shift = EmployeeShift.query.filter_by(id=shift_id, store_id=store_id).first()
    if shift is None:
        raise NotFoundError("Employee shift not found.", code="SHIFT_NOT_FOUND")
    if not reason or not reason.strip():
        raise ValidationError("A void reason is required.", code="REASON_REQUIRED")
    if shift.voided:
        raise BusinessRuleError("Employee shift is already voided.", code="SHIFT_ALREADY_VOIDED")

    now = datetime.now(timezone.utc)
    shift.voided            = True
    shift.voided_at         = now
    shift.voided_by_user_id = admin_user_id
    shift.void_reason       = reason.strip()

    # Voiding an open shift implicitly closes it
    if shift.status == "open":
        shift.status    = "closed"
        shift.closed_at = now
        shift.closed_by_user_id = admin_user_id

    db.session.commit()
    return shift
