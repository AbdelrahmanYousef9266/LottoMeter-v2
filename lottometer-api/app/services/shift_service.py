"""Shift service — open, list, get, close, handover."""

from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models.shift_details import ShiftDetails
from app.models.book import Book
from app.models.slot import Slot
from app.models.user import User
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
    skip_carried_forward_books: set[int] | None = None,
) -> list[Book]:
    """List the books that need an open scan in this sub-shift.

    Until ShiftBooks exists (Step 3), we compute pending = all active books,
    optionally minus a set of book_ids that would have been carried forward
    from a clean-close handover.
    """
    skip = skip_carried_forward_books or set()
    return [b for b in _all_active_books(store_id) if b.book_id not in skip]


# ---------- Internal: close a sub-shift in-place ----------

def _close_subshift_in_place(
    sub: ShiftDetails,
    user_id: int,
    cash_in_hand: str,
    gross_sales: str,
    cash_out: str,
) -> None:
    """Apply closing fields + status to the given sub-shift.

    Step 3 will compute tickets_total from scans + whole-book sales + returns.
    For now, tickets_total = 0.
    """
    cash_in_hand_d = Decimal(cash_in_hand)
    gross_sales_d = Decimal(gross_sales)
    cash_out_d = Decimal(cash_out)

    tickets_total = Decimal("0.00")  # TODO Step 3
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
    """Compute main shift totals as the sum of non-voided sub-shifts."""
    subs = [
        s for s in _get_subshifts_for(main.shift_id) if not s.voided
    ]
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


# ---------- Open ----------

def open_main_shift(store_id: int, user_id: int) -> tuple[ShiftDetails, ShiftDetails]:
    """Open a new main shift and auto-create Sub-shift 1."""
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


# ---------- Close main shift (final close) ----------

def close_main_shift(
    store_id: int,
    main_shift_id: int,
    user_id: int,
    cash_in_hand: str,
    gross_sales: str,
    cash_out: str,
) -> ShiftDetails:
    """Close the final sub-shift AND the main shift."""
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

    # TODO Step 3: verify every active book has a close scan in this sub-shift

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
    """Close current sub-shift, open the next one within the same main shift.

    Returns: (closed_subshift, new_subshift, pending_books, carried_forward_count)

    Per SRS §5.9:
    - If closed status == correct → carry forward close positions (Step 3 will
      actually create the carried-forward ShiftBooks rows).
    - If short/over → no carry-forward; every active book is pending.

    For now (Step 2), we only count what *would* be carried forward and adjust
    the new sub-shift's pending list accordingly. ShiftBooks creation lands in
    Step 3.
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

    # TODO Step 3: verify every active book has a close scan before allowing close

    _close_subshift_in_place(current, user_id, cash_in_hand, gross_sales, cash_out)
    db.session.flush()

    # Decide carry-forward eligibility
    carry_forward = current.shift_status == "correct"
    carried_forward_book_ids: set[int] = set()
    carried_forward_count = 0

    if carry_forward:
        # Step 3 will create ShiftBooks rows with scan_source='carried_forward'.
        # For now we just count active books — they'd all be carried.
        active = _all_active_books(store_id)
        carried_forward_book_ids = {b.book_id for b in active}
        carried_forward_count = len(carried_forward_book_ids)

    # Open the next sub-shift
    new_sub = ShiftDetails(
        store_id=store_id,
        opened_by_user_id=user_id,
        is_shift_open=True,
        main_shift_id=main_shift_id,
        shift_number=_next_subshift_number(main_shift_id),
    )
    db.session.add(new_sub)
    db.session.commit()

    pending_books = get_pending_scans_for_subshift(
        store_id, new_sub, skip_carried_forward_books=carried_forward_book_ids
    )

    return current, new_sub, pending_books, carried_forward_count