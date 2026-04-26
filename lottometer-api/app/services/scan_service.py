"""Scan service — the 8-rule scan endpoint + last-ticket detection.

Per SRS §5.7 and FR-SCAN-01..12.
"""

from datetime import datetime, timezone

from app.extensions import db
from app.models.book import Book
from app.models.book_assignment_history import BookAssignmentHistory
from app.models.shift_details import ShiftDetails
from app.models.shift_books import ShiftBooks
from app.constants import LENGTH_BY_PRICE
from app.errors import (
    NotFoundError,
    ValidationError,
    ConflictError,
    BusinessRuleError,
)
from app.services.book_service import parse_barcode


def _get_subshift(store_id: int, shift_id: int) -> ShiftDetails:
    sub = (
        ShiftDetails.query
        .filter_by(shift_id=shift_id, store_id=store_id)
        .first()
    )
    if sub is None or sub.main_shift_id is None:
        raise NotFoundError(
            "Sub-shift not found.",
            code="SUBSHIFT_NOT_FOUND",
        )
    if sub.voided:
        raise BusinessRuleError(
            "Sub-shift has been voided.",
            code="SHIFT_VOIDED",
        )
    if not sub.is_shift_open:
        raise BusinessRuleError(
            "Sub-shift is closed.",
            code="SHIFT_CLOSED",
        )
    return sub


def _has_any_close_scan_in_subshift(shift_id: int) -> bool:
    return (
        ShiftBooks.query
        .filter_by(shift_id=shift_id, scan_type="close")
        .first()
        is not None
    )


def _existing_scan(shift_id: int, static_code: str, scan_type: str) -> ShiftBooks | None:
    return (
        ShiftBooks.query
        .filter_by(shift_id=shift_id, static_code=static_code, scan_type=scan_type)
        .first()
    )


def _open_scan_for(shift_id: int, static_code: str) -> ShiftBooks | None:
    return _existing_scan(shift_id, static_code, "open")


def record_scan(
    store_id: int,
    user_id: int,
    shift_id: int,
    barcode: str,
    scan_type: str,
):
    """Process a scan with all 8 SRS rules.

    Returns: (scan_row, book, subshift)
    """
    sub = _get_subshift(store_id, shift_id)
    static_code, position = parse_barcode(barcode)

    # Rule 1: static_code matches an active book in this store
    book = (
        Book.query
        .filter_by(store_id=store_id, static_code=static_code)
        .first()
    )
    if book is None:
        raise NotFoundError(
            "No book found matching this barcode.",
            code="BOOK_NOT_FOUND",
        )

    # Rule 3: book not already sold
    if book.is_sold:
        raise BusinessRuleError(
            "Book has already been fully sold.",
            code="BOOK_ALREADY_SOLD",
        )

    # Rule 2: book is in a slot (active)
    if not book.is_active:
        raise BusinessRuleError(
            "Book is not currently in a slot.",
            code="BOOK_NOT_ACTIVE",
        )

    # Rule 6: position in range
    book_length = LENGTH_BY_PRICE[book.ticket_price]
    if not (0 <= position < book_length):
        raise ValidationError(
            f"Position {position} is out of range for ${book.ticket_price} books "
            f"(valid range: 0..{book_length - 1}).",
            code="INVALID_POSITION",
        )

    # Rule 8: cannot REWRITE an existing open scan after any close scan has started.
    # New opens for newly-assigned books are still allowed (they have no prior open
    # scan in this sub-shift, so this isn't a "rewrite").
    if scan_type == "open" and _has_any_close_scan_in_subshift(shift_id):
        prior_open = _open_scan_for(shift_id, static_code)
        if prior_open is not None:
            raise ConflictError(
                "Cannot rewrite open scan after closing has started on this sub-shift.",
                code="OPEN_RESCAN_BLOCKED",
            )

    # Rule 7: close position >= open position
    if scan_type == "close":
        open_row = _open_scan_for(shift_id, static_code)
        if open_row is None:
            raise BusinessRuleError(
                "Cannot record close scan: no open scan exists for this book in this sub-shift.",
                code="NO_OPEN_SCAN",
            )
        if position < open_row.start_at_scan:
            raise ValidationError(
                f"Close position ({position}) cannot be less than open position "
                f"({open_row.start_at_scan}).",
                code="POSITION_BEFORE_OPEN",
            )

    # Rule 5: duplicate (same shift + book + scan_type) → overwrite
    is_last_ticket = (position == book_length - 1)
    existing = _existing_scan(shift_id, static_code, scan_type)

    if existing is not None:
        existing.barcode = barcode
        existing.start_at_scan = position
        existing.is_last_ticket = is_last_ticket
        existing.scan_source = "scanned"
        existing.slot_id = book.slot_id
        existing.scanned_at = datetime.now(timezone.utc)
        existing.scanned_by_user_id = user_id
        scan_row = existing
    else:
        scan_row = ShiftBooks(
            shift_id=shift_id,
            static_code=static_code,
            scan_type=scan_type,
            barcode=barcode,
            start_at_scan=position,
            is_last_ticket=is_last_ticket,
            scan_source="scanned",
            slot_id=book.slot_id,
            store_id=store_id,
            scanned_by_user_id=user_id,
        )
        db.session.add(scan_row)

    # Last-ticket detection: marks the book sold ONLY when a close scan at
    # the last position represents an actual sale this shift.
    sold_this_scan = False
    if is_last_ticket and scan_type == "close":
        open_row = _open_scan_for(shift_id, static_code)
        if open_row is not None and position > open_row.start_at_scan:
            sold_this_scan = True

    if sold_this_scan:
        book.is_sold = True
        book.is_active = False
        book.slot_id = None

        history = (
            BookAssignmentHistory.query
            .filter_by(book_id=book.book_id, unassigned_at=None)
            .order_by(BookAssignmentHistory.assigned_at.desc())
            .first()
        )
        if history is not None:
            history.unassigned_at = datetime.now(timezone.utc)
            history.unassigned_by_user_id = user_id
            history.unassign_reason = "sold"

    db.session.commit()
    return scan_row, book, sub


def get_running_totals(shift_id: int) -> dict:
    """Compact stats for the sub-shift: scan counts."""
    open_count = (
        ShiftBooks.query
        .filter_by(shift_id=shift_id, scan_type="open")
        .count()
    )
    close_count = (
        ShiftBooks.query
        .filter_by(shift_id=shift_id, scan_type="close")
        .count()
    )
    return {
        "books_scanned_open": open_count,
        "books_scanned_close": close_count,
    }


def pending_scans_remaining(store_id: int, shift_id: int) -> int:
    """Count active books that don't yet have an open scan in this sub-shift."""
    active = (
        Book.query
        .filter_by(store_id=store_id, is_active=True, is_sold=False)
        .all()
    )
    open_static_codes = {
        s.static_code for s in
        ShiftBooks.query.filter_by(shift_id=shift_id, scan_type="open").all()
    }
    return sum(1 for b in active if b.static_code not in open_static_codes)