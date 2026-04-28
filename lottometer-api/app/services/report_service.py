"""Report service — assembles the full main shift report payload."""

from decimal import Decimal
from collections import defaultdict

from app.models.shift_details import ShiftDetails
from app.models.shift_books import ShiftBooks
from app.models.shift_extra_sales import ShiftExtraSales
from app.models.book import Book
from app.models.slot import Slot
from app.models.user import User
from app.errors import NotFoundError


def _user_summary(user_map: dict, user_id: int | None):
    if user_id is None:
        return None
    u = user_map.get(user_id)
    if u is None:
        return {"user_id": user_id, "username": None}
    return {"user_id": u.user_id, "username": u.username}


def _money(d: Decimal | None) -> str | None:
    if d is None:
        return None
    return str(d.quantize(Decimal("0.01")))


def _build_user_map(user_ids: set[int]) -> dict[int, User]:
    user_ids = {uid for uid in user_ids if uid is not None}
    if not user_ids:
        return {}
    return {
        u.user_id: u
        for u in User.query.filter(User.user_id.in_(user_ids)).all()
    }


def _build_slot_name_map(slot_ids: set[int]) -> dict[int, str]:
    slot_ids = {sid for sid in slot_ids if sid is not None}
    if not slot_ids:
        return {}
    return {
        s.slot_id: s.slot_name
        for s in Slot.query.filter(Slot.slot_id.in_(slot_ids)).all()
    }


def _build_book_map_by_static_code(static_codes: set[str], store_id: int) -> dict[str, Book]:
    if not static_codes:
        return {}
    return {
        b.static_code: b
        for b in Book.query.filter(
            Book.store_id == store_id, Book.static_code.in_(static_codes)
        ).all()
    }


def _per_book_lines_for_subshift(
    subshift_id: int,
    store_id: int,
    user_map: dict,
    slot_map: dict,
) -> tuple[list[dict], list[dict]]:
    """Returns (regular_books, returned_books) lines for a sub-shift.

    'returned_books' = books whose close scan has scan_source='returned_to_vendor'.
    """
    open_scans = {
        s.static_code: s for s in
        ShiftBooks.query.filter_by(shift_id=subshift_id, store_id=store_id, scan_type="open").all()
    }
    close_scans = {
        s.static_code: s for s in
        ShiftBooks.query.filter_by(shift_id=subshift_id, store_id=store_id, scan_type="close").all()
    }
    static_codes = set(open_scans) | set(close_scans)
    book_map = _build_book_map_by_static_code(static_codes, store_id)

    regular = []
    returned = []

    for static_code in sorted(static_codes):
        book = book_map.get(static_code)
        if book is None:
            continue

        open_scan = open_scans.get(static_code)
        close_scan = close_scans.get(static_code)

        open_position = open_scan.start_at_scan if open_scan else None
        close_position = close_scan.start_at_scan if close_scan else None

        tickets_sold = 0
        if open_scan and close_scan:
            tickets_sold = close_scan.start_at_scan - open_scan.start_at_scan
            if close_scan.is_last_ticket:
                tickets_sold += 1

        price = book.ticket_price or Decimal("0.00")
        value = (Decimal(tickets_sold) * price).quantize(Decimal("0.01"))

        slot_name = slot_map.get(
            (close_scan or open_scan).slot_id if (close_scan or open_scan) else None
        )

        if close_scan and close_scan.scan_source == "returned_to_vendor":
            returned.append({
                "book_id": book.book_id,
                "static_code": book.static_code,
                "slot_name": slot_name,
                "ticket_price": _money(price),
                "open_position": open_position,
                "returned_at_position": close_position,
                "tickets_sold": tickets_sold,
                "value": _money(value),
                "returned_at": book.returned_at.isoformat() + "Z" if book.returned_at else None,
                "returned_by": _user_summary(user_map, book.returned_by_user_id),
            })
        else:
            regular.append({
                "book_id": book.book_id,
                "static_code": book.static_code,
                "book_name": book.book_name,
                "slot_name": slot_name,
                "ticket_price": _money(price),
                "open_position": open_position,
                "close_position": close_position,
                "tickets_sold": tickets_sold,
                "value": _money(value),
                "fully_sold": close_scan.is_last_ticket if close_scan else False,
                "scan_source_open": open_scan.scan_source if open_scan else None,
                "scan_source_close": close_scan.scan_source if close_scan else None,
            })

    return regular, returned


def _whole_book_sales_for_subshift(
    subshift_id: int, store_id: int, user_map: dict
) -> list[dict]:
    extras = (
        ShiftExtraSales.query
        .filter_by(shift_id=subshift_id, store_id=store_id)
        .order_by(ShiftExtraSales.created_at)
        .all()
    )
    return [
        {
            "extra_sale_id": e.extra_sale_id,
            "scanned_barcode": e.scanned_barcode,
            "ticket_price": _money(e.ticket_price),
            "ticket_count": e.ticket_count,
            "value": _money(e.value),
            "note": e.note,
            "created_at": e.created_at.isoformat() + "Z",
            "created_by": _user_summary(user_map, e.created_by_user_id),
        }
        for e in extras
    ]


def _ticket_breakdown_for_subshift(
    subshift_id: int, store_id: int
) -> list[dict]:
    """Lines grouped by (ticket_price, source: scanned|whole_book)."""
    # scanned: from open/close scans (excluding returned_to_vendor and excluding rows
    # without a paired open). returned_to_vendor close scans count as scanned sales.
    # In SRS terminology: "scanned" = book sales scanned during shift; "whole_book" = bulk sales.

    # Gather scanned sales
    open_scans = {
        s.static_code: s for s in
        ShiftBooks.query.filter_by(shift_id=subshift_id, store_id=store_id, scan_type="open").all()
    }
    close_scans = ShiftBooks.query.filter_by(shift_id=subshift_id, store_id=store_id, scan_type="close").all()
    static_codes = set(open_scans) | {c.static_code for c in close_scans}
    book_map = _build_book_map_by_static_code(static_codes, store_id)

    # price → tickets_sold
    scanned_totals: dict[Decimal, int] = defaultdict(int)
    for close in close_scans:
        open_scan = open_scans.get(close.static_code)
        if open_scan is None:
            continue
        book = book_map.get(close.static_code)
        if book is None or book.ticket_price is None:
            continue
        sold = close.start_at_scan - open_scan.start_at_scan
        if close.is_last_ticket:
            sold += 1
        if sold > 0:
            scanned_totals[book.ticket_price] += sold

    # Whole-book sales totals
    whole_totals: dict[Decimal, int] = defaultdict(int)
    for e in ShiftExtraSales.query.filter_by(shift_id=subshift_id, store_id=store_id).all():
        whole_totals[e.ticket_price] += e.ticket_count

    lines = []
    for price, count in sorted(scanned_totals.items()):
        lines.append({
            "ticket_price": _money(price),
            "source": "scanned",
            "tickets_sold": count,
            "subtotal": _money(price * count),
        })
    for price, count in sorted(whole_totals.items()):
        lines.append({
            "ticket_price": _money(price),
            "source": "whole_book",
            "tickets_sold": count,
            "subtotal": _money(price * count),
        })
    return lines


def _ticket_breakdown_combined(subshift_lines_list: list[list[dict]]) -> list[dict]:
    """Aggregate sub-shift breakdown lines into a single combined breakdown."""
    combined: dict[tuple, dict] = {}
    for lines in subshift_lines_list:
        for line in lines:
            key = (line["ticket_price"], line["source"])
            if key not in combined:
                combined[key] = {
                    "ticket_price": line["ticket_price"],
                    "source": line["source"],
                    "tickets_sold": 0,
                    "subtotal_decimal": Decimal("0.00"),
                }
            combined[key]["tickets_sold"] += line["tickets_sold"]
            combined[key]["subtotal_decimal"] += Decimal(line["subtotal"])

    out = []
    for v in sorted(
        combined.values(),
        key=lambda x: (x["source"], Decimal(x["ticket_price"])),
    ):
        out.append({
            "ticket_price": v["ticket_price"],
            "source": v["source"],
            "tickets_sold": v["tickets_sold"],
            "subtotal": _money(v["subtotal_decimal"]),
        })
    return out


def build_main_shift_report(store_id: int, main_shift_id: int) -> dict:
    """Assemble the full report payload for a main shift."""
    main = (
        ShiftDetails.query
        .filter_by(shift_id=main_shift_id, store_id=store_id, main_shift_id=None)
        .first()
    )
    if main is None:
        raise NotFoundError("Main shift not found.", code="SHIFT_NOT_FOUND")

    subs = (
        ShiftDetails.query
        .filter_by(store_id=store_id, main_shift_id=main_shift_id)
        .order_by(ShiftDetails.shift_number)
        .all()
    )

    # Collect user_ids upfront for one query
    user_ids = {main.opened_by_user_id, main.closed_by_user_id, main.voided_by_user_id}
    for s in subs:
        user_ids.update({s.opened_by_user_id, s.closed_by_user_id, s.voided_by_user_id})
    # Plus return-to-vendor users from books referenced in scans
    static_codes_in_subs = set()
    for s in subs:
        for sb in ShiftBooks.query.filter_by(shift_id=s.shift_id, store_id=store_id).all():
            static_codes_in_subs.add(sb.static_code)
    if static_codes_in_subs:
        for b in Book.query.filter(
            Book.store_id == store_id, Book.static_code.in_(static_codes_in_subs)
        ).all():
            if b.returned_by_user_id:
                user_ids.add(b.returned_by_user_id)
    # Cleanup the leftover variable name no longer used
    # Plus whole-book-sale creators
    for s in subs:
        for e in ShiftExtraSales.query.filter_by(shift_id=s.shift_id, store_id=store_id).all():
            user_ids.add(e.created_by_user_id)

    user_map = _build_user_map(user_ids)

    # Collect slot_ids
    slot_ids = set()
    for s in subs:
        for sb in ShiftBooks.query.filter_by(shift_id=s.shift_id, store_id=store_id).all():
            if sb.slot_id is not None:
                slot_ids.add(sb.slot_id)
    slot_map = _build_slot_name_map(slot_ids)

    # Build per-sub-shift entries
    subshift_entries = []
    voided_entries = []
    breakdown_lines_for_combined = []

    for s in subs:
        regular_books, returned_books = _per_book_lines_for_subshift(
            s.shift_id, store_id, user_map, slot_map
        )
        whole_book_sales = _whole_book_sales_for_subshift(s.shift_id, store_id, user_map)
        breakdown = _ticket_breakdown_for_subshift(s.shift_id, store_id)

        entry = {
            "shift_id": s.shift_id,
            "shift_number": s.shift_number,
            "voided": s.voided,
            "void_reason": s.void_reason,
            "voided_at": s.voided_at.isoformat() + "Z" if s.voided_at else None,
            "voided_by": _user_summary(user_map, s.voided_by_user_id),
            "opened_by": _user_summary(user_map, s.opened_by_user_id),
            "closed_by": _user_summary(user_map, s.closed_by_user_id),
            "shift_start_time": s.shift_start_time.isoformat() + "Z",
            "shift_end_time": s.shift_end_time.isoformat() + "Z" if s.shift_end_time else None,
            "cash_in_hand": _money(s.cash_in_hand),
            "gross_sales": _money(s.gross_sales),
            "cash_out": _money(s.cash_out),
            "tickets_total": _money(s.tickets_total),
            "expected_cash": _money(s.expected_cash),
            "difference": _money(s.difference),
            "shift_status": s.shift_status,
            "ticket_breakdown": breakdown,
            "books": regular_books,
            "whole_book_sales": whole_book_sales,
            "returned_books": returned_books,
        }

        if s.voided:
            voided_entries.append(entry)
        else:
            subshift_entries.append(entry)
            breakdown_lines_for_combined.append(breakdown)

    # Combined main-shift breakdown across non-voided sub-shifts
    combined_breakdown = _ticket_breakdown_combined(breakdown_lines_for_combined)

    return {
        "main_shift": {
            "shift_id": main.shift_id,
            "shift_start_time": main.shift_start_time.isoformat() + "Z",
            "shift_end_time": main.shift_end_time.isoformat() + "Z" if main.shift_end_time else None,
            "voided": main.voided,
            "void_reason": main.void_reason,
            "voided_at": main.voided_at.isoformat() + "Z" if main.voided_at else None,
            "voided_by": _user_summary(user_map, main.voided_by_user_id),
            "opened_by": _user_summary(user_map, main.opened_by_user_id),
            "closed_by": _user_summary(user_map, main.closed_by_user_id),
            "totals": {
                "tickets_total": _money(main.tickets_total),
                "gross_sales": _money(main.gross_sales),
                "expected_cash": _money(main.expected_cash),
                "cash_in_hand": _money(main.cash_in_hand),
                "cash_out": _money(main.cash_out),
                "difference": _money(main.difference),
                "shift_status": main.shift_status,
            },
            "ticket_breakdown": combined_breakdown,
        },
        "subshifts": subshift_entries,
        "voided_subshifts": voided_entries,
    }