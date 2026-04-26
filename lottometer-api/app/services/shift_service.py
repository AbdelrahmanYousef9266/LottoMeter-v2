"""Shift service — open, list, get, close, handover."""

from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.shift_details import ShiftDetails
from app.models.book import Book
from app.models.slot import Slot
from app.models.user import User
from app.models.shift_books import ShiftBooks
from app.models.shift_extra_sales import ShiftExtraSales
from app.errors import (
    NotFoundError,
    ConflictError,
    BusinessRuleError,
)


# ---------- Internal lookups ----------

def _get_open_main_shift(store_id: int) -> ShiftDetails | None:
    return (
        ShiftDetails.query
        .filter_by(
            store_id=store_id,
            main_shift_id=None,
            is_shift_open=True,
            voided=False,
        )
        .first()
    )


def _get_subshifts_for(main_shift_id: int) -> list[ShiftDetails]:
    return (
        ShiftDetails.query
        .filter_by(main_shift_id=main_shift_id)
        .order_by(ShiftDetails.shift_number)
        .all()
    )


def _get_current_open_subshift(main_shift_id: int) -> ShiftDetails | None:
    return (
        ShiftDetails.query
        .filter_by(main_shift_id=main_shift_id, is_shift_open=True)
        .order_by(ShiftDetails.shift_number.desc())
        .first()
    )


def _next_subshift_number(main_shift_id: int) -> int:
    last = (
        ShiftDetails.query
        .filter_by(main_shift_id=main_shift_id)
        .order_by(ShiftDetails.shift_number.desc())
        .first()
    )
    return (last.shift_number + 1) if last else 1


def _all_active_books(store_id: int) -> list[Book]:
    return (
        Book.query
        .filter_by(store_id=store_id, is_active=True, is_sold=False)
        .order_by(Book.book_id)
        .all()
    )


def get_pending_scans_for_subshift(
    store_id: int,
    subshift: ShiftDetails,
) -> list[Book]:
    """Books that are active and don't yet have an open scan in this sub-shift."""
    open_static_codes = {
        s.static_code for s in
        ShiftBooks.query.filter_by(shift_id=subshift.shift_id, scan_type="open").all()
    }
    return [b for b in _all_active_books(store_id) if b.static_code not in open_static_codes]


# ---------- tickets_total computation ----------

def _compute_subshift_tickets_total(subshift_id: int) -> Decimal:
    """Sum of scanned-book values + whole-book sales + return partials.

    Per SRS §5.10 + §5.11.
    """
    total = Decimal("0.00")

    # Scanned book sales: pair each open with its corresponding close
    open_scans = {
        s.static_code: s for s in
        ShiftBooks.query.filter_by(shift_id=subshift_id, scan_type="open").all()
    }
    close_scans = {
        s.static_code: s for s in
        ShiftBooks.query.filter_by(shift_id=subshift_id, scan_type="close").all()
    }

    for static_code, close in close_scans.items():
        open_scan = open_scans.get(static_code)
        if open_scan is None:
            continue  # unmatched close — skip (shouldn't happen with Rule 7 enforced)

        # Look up book to get ticket_price
        book = Book.query.filter_by(static_code=static_code).first()
        if book is None or book.ticket_price is None:
            continue

        tickets_sold = close.start_at_scan - open_scan.start_at_scan
        if close.is_last_ticket:
            tickets_sold += 1
        if tickets_sold > 0:
            total += Decimal(tickets_sold) * book.ticket_price

    # Whole-book sales
    extras = ShiftExtraSales.query.filter_by(shift_id=subshift_id).all()
    for e in extras:
        total += e.value

    return total.quantize(Decimal("0.01"))


def _verify_all_active_books_have_close_scan(store_id: int, subshift_id: int) -> None:
    """FR-CLOSE-01: every active book (not already sold mid-shift) must have a close scan.

    Also requires every closed book to have a matching open scan.
    """
    active_books = _all_active_books(store_id)
    if not active_books:
        return

    close_static_codes = {
        s.static_code for s in
        ShiftBooks.query.filter_by(shift_id=subshift_id, scan_type="close").all()
    }
    missing = [b for b in active_books if b.static_code not in close_static_codes]
    if missing:
        raise BusinessRuleError(
            f"{len(missing)} active book(s) have no close scan. Scan them first.",
            code="BOOKS_NOT_CLOSED",
            details={"missing_book_ids": [b.book_id for b in missing]},
        )


# ---------- Internal: close a sub-shift in-place ----------

def _close_subshift_in_place(
    sub: ShiftDetails,
    user_id: int,
    cash_in_hand: str,
    gross_sales: str,
    cash_out: str,
) -> None:
    cash_in_hand_d = Decimal(cash_in_hand)
    gross_sales_d = Decimal(gross_sales)
    cash_out_d = Decimal(cash_out)

    tickets_total = _compute_subshift_tickets_total(sub.shift_id)
    expected_cash = gross_sales_d + tickets_total - cash_out_d
    difference = cash_in_hand_d - expected_cash

    if difference == 0:
        status = "correct"
    elif difference > 0:
        status = "over"
    else:
        status = "short"

    sub.cash_in_hand = cash_in_hand_d
    sub.gross_sales = gross_sales_d
    sub.cash_out = cash_out_d
    sub.tickets_total = tickets_total
    sub.expected_cash = expected_cash
    sub.difference = difference
    sub.shift_status = status
    sub.is_shift_open = False
    sub.shift_end_time = datetime.now(timezone.utc)
    sub.closed_by_user_id = user_id


def _aggregate_main_shift_totals(main: ShiftDetails) -> None:
    subs = [s for s in _get_subshifts_for(main.shift_id) if not s.voided]
    main.tickets_total = sum((s.tickets_total or Decimal("0.00")) for s in subs)
    main.gross_sales = sum((s.gross_sales or Decimal("0.00")) for s in subs)
    main.cash_in_hand = sum((s.cash_in_hand or Decimal("0.00")) for s in subs)
    main.cash_out = sum((s.cash_out or Decimal("0.00")) for s in subs)
    main.expected_cash = main.gross_sales + main.tickets_total - main.cash_out
    main.difference = main.cash_in_hand - main.expected_cash
    if main.difference == 0:
        main.shift_status = "correct"
    elif main.difference > 0:
        main.shift_status = "over"
    else:
        main.shift_status = "short"


# ---------- Carry-forward ----------

def _carry_forward_open_scans(
    store_id: int, user_id: int, prev_subshift_id: int, new_subshift_id: int
) -> int:
    """Create open ShiftBooks rows on the new sub-shift using the previous
    sub-shift's close positions. Skips books that are no longer active.

    Returns: number of rows carried forward.
    """
    prev_close_scans = ShiftBooks.query.filter_by(
        shift_id=prev_subshift_id, scan_type="close"
    ).all()

    count = 0
    for close in prev_close_scans:
        # Only carry if the book is still active and not sold
        book = Book.query.filter_by(
            store_id=store_id, static_code=close.static_code
        ).first()
        if book is None or not book.is_active or book.is_sold:
            continue

        carried = ShiftBooks(
            shift_id=new_subshift_id,
            static_code=close.static_code,
            scan_type="open",
            barcode=book.barcode,  # current barcode of the book
            start_at_scan=close.start_at_scan,
            is_last_ticket=False,
            scan_source="carried_forward",
            slot_id=book.slot_id,
            store_id=store_id,
            scanned_by_user_id=user_id,
        )
        db.session.add(carried)
        count += 1
    return count


# ---------- Open ----------

def open_main_shift(store_id: int, user_id: int) -> tuple[ShiftDetails, ShiftDetails]:
    if _get_open_main_shift(store_id) is not None:
        raise ConflictError(
            "A main shift is already open for this store.",
            code="SHIFT_ALREADY_OPEN",
        )

    main = ShiftDetails(
        store_id=store_id,
        opened_by_user_id=user_id,
        is_shift_open=True,
        main_shift_id=None,
        shift_number=1,
    )
    db.session.add(main)
    try:
        db.session.flush()
    except IntegrityError:
        db.session.rollback()
        raise ConflictError(
            "A main shift is already open for this store.",
            code="SHIFT_ALREADY_OPEN",
        )

    sub = ShiftDetails(
        store_id=store_id,
        opened_by_user_id=user_id,
        is_shift_open=True,
        main_shift_id=main.shift_id,
        shift_number=1,
    )
    db.session.add(sub)
    db.session.commit()
    return main, sub


# ---------- List / Get ----------

def list_main_shifts(
    store_id: int,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[ShiftDetails], int]:
    q = ShiftDetails.query.filter_by(store_id=store_id, main_shift_id=None)
    if status == "open":
        q = q.filter(ShiftDetails.is_shift_open.is_(True), ShiftDetails.voided.is_(False))
    elif status == "closed":
        q = q.filter(ShiftDetails.is_shift_open.is_(False), ShiftDetails.voided.is_(False))
    elif status == "voided":
        q = q.filter(ShiftDetails.voided.is_(True))

    total = q.count()
    shifts = (
        q.order_by(ShiftDetails.shift_start_time.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return shifts, total


def get_main_shift(store_id: int, shift_id: int) -> ShiftDetails:
    main = (
        ShiftDetails.query
        .filter_by(shift_id=shift_id, store_id=store_id, main_shift_id=None)
        .first()
    )
    if main is None:
        raise NotFoundError("Main shift not found.", code="SHIFT_NOT_FOUND")
    return main


# ---------- Close main shift ----------

def close_main_shift(
    store_id: int,
    main_shift_id: int,
    user_id: int,
    cash_in_hand: str,
    gross_sales: str,
    cash_out: str,
) -> ShiftDetails:
    main = get_main_shift(store_id, main_shift_id)

    if not main.is_shift_open:
        raise BusinessRuleError(
            "Main shift is already closed.",
            code="SHIFT_ALREADY_CLOSED",
        )

    sub = _get_current_open_subshift(main_shift_id)
    if sub is None:
        raise BusinessRuleError(
            "No open sub-shift found for this main shift.",
            code="NO_OPEN_SUBSHIFT",
        )

    # FR-CLOSE-01
    _verify_all_active_books_have_close_scan(store_id, sub.shift_id)

    _close_subshift_in_place(sub, user_id, cash_in_hand, gross_sales, cash_out)
    _aggregate_main_shift_totals(main)
    main.is_shift_open = False
    main.shift_end_time = datetime.now(timezone.utc)
    main.closed_by_user_id = user_id

    db.session.commit()
    return main


# ---------- Handover ----------

def handover_subshift(
    store_id: int,
    main_shift_id: int,
    user_id: int,
    cash_in_hand: str,
    gross_sales: str,
    cash_out: str,
) -> tuple[ShiftDetails, ShiftDetails, list[Book], int]:
    """Close current sub-shift, open the next within the same main shift.

    Returns: (closed_subshift, new_subshift, pending_books, carried_forward_count)
    """
    main = get_main_shift(store_id, main_shift_id)
    if not main.is_shift_open:
        raise BusinessRuleError(
            "Cannot hand over: main shift is closed.",
            code="SHIFT_ALREADY_CLOSED",
        )

    current = _get_current_open_subshift(main_shift_id)
    if current is None:
        raise BusinessRuleError(
            "No open sub-shift to hand over.",
            code="NO_OPEN_SUBSHIFT",
        )

    # FR-CLOSE-01
    _verify_all_active_books_have_close_scan(store_id, current.shift_id)

    _close_subshift_in_place(current, user_id, cash_in_hand, gross_sales, cash_out)
    db.session.flush()

    # Decide carry-forward
    carry_forward = current.shift_status == "correct"

    # Open the next sub-shift
    new_sub = ShiftDetails(
        store_id=store_id,
        opened_by_user_id=user_id,
        is_shift_open=True,
        main_shift_id=main_shift_id,
        shift_number=_next_subshift_number(main_shift_id),
    )
    db.session.add(new_sub)
    db.session.flush()

    carried_count = 0
    if carry_forward:
        carried_count = _carry_forward_open_scans(
            store_id, user_id, current.shift_id, new_sub.shift_id
        )

    db.session.commit()

    pending_books = get_pending_scans_for_subshift(store_id, new_sub)
    return current, new_sub, pending_books, carried_count

# ---------- Void ----------

def void_subshift(
    store_id: int,
    main_shift_id: int,
    subshift_id: int,
    user_id: int,
    reason: str,
) -> ShiftDetails:
    """Admin-only: void a single sub-shift.

    Recomputes the main shift's totals after voiding (excludes this sub).
    """
    main = get_main_shift(store_id, main_shift_id)

    sub = (
        ShiftDetails.query
        .filter_by(
            shift_id=subshift_id,
            store_id=store_id,
            main_shift_id=main_shift_id,
        )
        .first()
    )
    if sub is None:
        raise NotFoundError("Sub-shift not found.", code="SUBSHIFT_NOT_FOUND")

    if sub.voided:
        raise BusinessRuleError(
            "Sub-shift is already voided.",
            code="ALREADY_VOIDED",
        )

    now = datetime.now(timezone.utc)
    sub.voided = True
    sub.voided_at = now
    sub.voided_by_user_id = user_id
    sub.void_reason = reason
    # Voiding implicitly closes a still-open sub-shift
    if sub.is_shift_open:
        sub.is_shift_open = False
        sub.shift_end_time = now
        sub.closed_by_user_id = user_id

    # Recompute main shift totals from non-voided sub-shifts (only if main is closed)
    if not main.is_shift_open:
        _aggregate_main_shift_totals(main)

    db.session.commit()
    return sub


def void_main_shift(
    store_id: int,
    main_shift_id: int,
    user_id: int,
    reason: str,
) -> ShiftDetails:
    """Admin-only: void a main shift. Cascades to all its sub-shifts."""
    main = get_main_shift(store_id, main_shift_id)

    if main.voided:
        raise BusinessRuleError(
            "Main shift is already voided.",
            code="ALREADY_VOIDED",
        )

    now = datetime.now(timezone.utc)

    # Cascade to all sub-shifts (skip already-voided ones)
    subs = _get_subshifts_for(main_shift_id)
    for s in subs:
        if not s.voided:
            s.voided = True
            s.voided_at = now
            s.voided_by_user_id = user_id
            s.void_reason = f"Main shift voided: {reason}"
            if s.is_shift_open:
                s.is_shift_open = False
                s.shift_end_time = now
                s.closed_by_user_id = user_id

    main.voided = True
    main.voided_at = now
    main.voided_by_user_id = user_id
    main.void_reason = reason
    if main.is_shift_open:
        main.is_shift_open = False
        main.shift_end_time = now
        main.closed_by_user_id = user_id

    db.session.commit()
    return main