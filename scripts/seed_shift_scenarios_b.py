#!/usr/bin/env python3
"""LottoMeter v2.0 — Seeder B: Shift-Lifecycle Scenarios

Adds shift activity on top of seeder A's assignment-phase state.

Startup logic:
  1. Try login. If login fails -> setup_store_and_admin() + seed_all_assignment_groups().
  2. If login succeeds + shifts exist -> reset_store() + seed_all_assignment_groups().
  3. If login succeeds + no shifts -> proceed directly to shift seeding.

Shift plan:
  Main Shift 1: Sub1 correct, Sub2 correct (engineered $5 last-ticket),
                Sub3 correct + return-to-vendor. Main closed correct.
  Main Shift 2: Sub1 short (engineered $1 last-ticket),
                Sub2 correct then VOIDED,
                Sub3 correct (engineered $20 last-ticket). Main closed correct.
  Main Shift 3: Sub1 correct, Sub2 over, Sub3 correct. Main closed -> then VOIDED.

Open-scan position convention:
  For new main shifts (no carry-forward available), each book is scanned open
  at book['start_position'] — the position it was originally assigned at. This
  is a seeder convention: it's not the book's exact current position but is
  consistent and produces valid shift data.

Usage:
    python scripts/seed_shift_scenarios_b.py
    LOTTOMETER_API_URL=http://my-dev:5000 python scripts/seed_shift_scenarios_b.py

Requires: requests, seed_edge_cases_a.py in the same directory.
"""

import os
import sys
import time
import random
import string
from typing import Optional

import requests

# Pull seeder A from same directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import seed_edge_cases_a as seeder_a

# ---------------------------------------------------------------------------
# Configuration (must match seeder A)
# ---------------------------------------------------------------------------

BASE_URL: str = seeder_a.BASE_URL
STORE_PIN: str = seeder_a.STORE_PIN
LENGTH_BY_PRICE: dict[str, int] = seeder_a.LENGTH_BY_PRICE

# ---------------------------------------------------------------------------
# HTTP helpers — reuse seeder A's, add api_put
# ---------------------------------------------------------------------------

_headers = seeder_a._headers
api_post = seeder_a.api_post
api_get = seeder_a.api_get
api_delete = seeder_a.api_delete
_abort = seeder_a._abort
format_barcode = seeder_a.format_barcode


def api_put(
    path: str,
    body: dict,
    token: str,
    expected: tuple[int, ...] = (200,),
) -> dict:
    url = f"{BASE_URL}{path}"
    resp = requests.put(url, json=body, headers=_headers(token))
    if resp.status_code not in expected:
        _abort(path, body, resp)
    return resp.json() if resp.content else {}


# ---------------------------------------------------------------------------
# Shift helpers
# ---------------------------------------------------------------------------

def fetch_active_books(token: str) -> list[dict]:
    """Return all currently active books from the API."""
    data = api_get("/api/books", token, params={"is_active": "true"})
    return [b for b in data.get("books", []) if b.get("is_active")]


def scan_open(token: str, subshift_id: int, static_code: str, position: int) -> None:
    barcode = format_barcode(static_code, position)
    api_post(
        "/api/scan",
        {"shift_id": subshift_id, "barcode": barcode, "scan_type": "open"},
        token,
        expected=(200,),
    )


def scan_close(token: str, subshift_id: int, static_code: str, position: int) -> None:
    barcode = format_barcode(static_code, position)
    api_post(
        "/api/scan",
        {"shift_id": subshift_id, "barcode": barcode, "scan_type": "close"},
        token,
        expected=(200,),
    )


def do_whole_book_sale(token: str, subshift_id: int, ticket_price: str) -> None:
    """Record a whole-book sale with a throwaway barcode."""
    wbs_code = "".join(random.choices(string.digits, k=10))
    barcode = f"{wbs_code}000"
    api_post(
        f"/api/shifts/{subshift_id}/whole-book-sale",
        {"barcode": barcode, "ticket_price": ticket_price, "pin": STORE_PIN},
        token,
        expected=(201,),
    )


def do_return_to_vendor(token: str, book: dict, open_pos: int) -> dict:
    """Return a book to vendor. Position = open_pos + 5 (capped below last ticket)."""
    book_len = LENGTH_BY_PRICE[book["ticket_price"]]
    return_pos = min(open_pos + 5, book_len - 2)
    return_pos = max(return_pos, open_pos)
    barcode = format_barcode(book["static_code"], return_pos)
    return api_post(
        f"/api/books/{book['book_id']}/return-to-vendor",
        {"barcode": barcode, "pin": STORE_PIN},
        token,
        expected=(200,),
    )


def compute_close_payload(
    token: str, subshift_id: int, target_status: str
) -> dict:
    """Fetch sub-shift summary and build a close payload producing the target status.

    target_status: "correct" | "short" | "over"
    Formula: expected_cash = gross_sales + tickets_total - cash_out
    """
    summary = api_get(f"/api/shifts/{subshift_id}/summary", token)
    tickets_total = float(summary["tickets_total"])
    gross_sales = round(tickets_total * 0.6, 2)
    cash_out = 0.0
    expected_cash = gross_sales + tickets_total - cash_out
    delta = {"correct": 0.0, "short": -5.0, "over": 3.0}[target_status]
    cash_in_hand = max(0.0, expected_cash + delta)
    return {
        "cash_in_hand": f"{cash_in_hand:.2f}",
        "gross_sales": f"{gross_sales:.2f}",
        "cash_out": f"{cash_out:.2f}",
    }


def scan_all_opens_for_pending(
    token: str,
    subshift_id: int,
    pending: list[dict],
    books_by_sc: dict[str, dict],
) -> dict[str, int]:
    """Scan open for every pending book at its start_position. Returns {sc: open_pos}."""
    open_pos: dict[str, int] = {}
    for p in pending:
        sc = p["static_code"]
        book = books_by_sc.get(sc)
        if book is None:
            continue
        pos = book["start_position"]
        scan_open(token, subshift_id, sc, pos)
        open_pos[sc] = pos
    return open_pos


def scan_all_closes(
    token: str,
    subshift_id: int,
    active_books: list[dict],
    open_positions: dict[str, int],
    overrides: Optional[dict[str, int]] = None,
) -> dict[str, int]:
    """Scan close for every active book. Returns {sc: close_pos}.

    overrides: {static_code: specific_close_position} for engineered events.
    Books not in open_positions fall back to book['start_position'].
    Close position is capped at book_length-2 to avoid accidental last-ticket,
    unless explicitly provided via overrides.
    """
    close_pos: dict[str, int] = {}
    for book in active_books:
        sc = book["static_code"]
        book_len = LENGTH_BY_PRICE[book["ticket_price"]]
        last = book_len - 1
        op = open_positions.get(sc, book["start_position"])

        if overrides and sc in overrides:
            cp = overrides[sc]
        else:
            cp = op + random.randint(1, 3)
            cp = min(cp, last - 1)   # stay one below last ticket
            cp = max(cp, op)          # never below open

        close_pos[sc] = cp
        scan_close(token, subshift_id, sc, cp)
    return close_pos


def _pick_last_ticket_book(
    active_books: list[dict],
    price: str,
    open_positions: dict[str, int],
) -> Optional[dict]:
    """Pick a book at the given price whose open position allows a last-ticket close."""
    book_len = LENGTH_BY_PRICE[price]
    last = book_len - 1
    candidates = [
        b for b in active_books
        if b["ticket_price"] == price
        and open_positions.get(b["static_code"], b["start_position"]) < last
    ]
    return random.choice(candidates) if candidates else None


# ---------------------------------------------------------------------------
# Main Shift 1 — 3 sub-shifts, all correct; $5 last-ticket; 1 return-to-vendor
# ---------------------------------------------------------------------------

def run_main_shift_1(token: str) -> tuple[int, Optional[dict], Optional[dict]]:
    """Run Main Shift 1.

    Sub1: all books pending, correct close.
    Sub2: carry-forward, engineered $5.00 last-ticket, correct close.
    Sub3: carry-forward, return-to-vendor on one book, correct close -> main closed.

    Returns: (main_shift_id, last_ticket_book_or_None, rtv_book_or_None)
    """
    print("  [MS1] Opening main shift...")
    resp = api_post("/api/shifts", {}, token, expected=(201,))
    main_id: int = resp["main_shift"]["shift_id"]
    sub_id: int = resp["current_subshift"]["shift_id"]
    pending = resp["current_subshift"]["pending_scans"]

    wbs_count = 0
    last_ticket_book = None
    rtv_book = None

    # ---- Sub-shift 1 ----
    active = fetch_active_books(token)
    books_by_sc = {b["static_code"]: b for b in active}

    # Scan all opens (all books are pending for a new main shift)
    open_pos: dict[str, int] = {}
    for p in pending:
        sc = p["static_code"]
        book = books_by_sc.get(sc)
        if book:
            pos = book["start_position"]
            scan_open(token, sub_id, sc, pos)
            open_pos[sc] = pos

    n = random.randint(0, 2)
    for _ in range(n):
        do_whole_book_sale(token, sub_id, random.choice(list(LENGTH_BY_PRICE)))
    wbs_count += n

    active = fetch_active_books(token)
    prev_close = scan_all_closes(token, sub_id, active, open_pos)

    payload = compute_close_payload(token, sub_id, "correct")
    resp = api_post(f"/api/shifts/{main_id}/subshifts", payload, token, expected=(200,))
    sub_id = resp["new_subshift"]["shift_id"]
    new_pending = resp["new_subshift"]["pending_scans"]
    print(f"  [MS1-S1] Closed correct. Carried {resp['new_subshift']['carried_forward_count']} books.")

    # ---- Sub-shift 2 — engineered $5 last-ticket ----
    active = fetch_active_books(token)
    books_by_sc = {b["static_code"]: b for b in active}

    # Build open_pos: carried books use prev_close; pending books use start_position
    open_pos = {}
    pending_scs = {p["static_code"] for p in new_pending}
    for book in active:
        sc = book["static_code"]
        if sc in pending_scs:
            pos = book["start_position"]
            scan_open(token, sub_id, sc, pos)
        else:
            pos = prev_close.get(sc, book["start_position"])
        open_pos[sc] = pos

    n = random.randint(0, 2)
    for _ in range(n):
        do_whole_book_sale(token, sub_id, random.choice(list(LENGTH_BY_PRICE)))
    wbs_count += n

    # Pick $5 book for last-ticket close at position 59
    active = fetch_active_books(token)
    last_ticket_book = _pick_last_ticket_book(active, "5.00", open_pos)
    overrides: dict[str, int] = {}
    if last_ticket_book:
        overrides[last_ticket_book["static_code"]] = LENGTH_BY_PRICE["5.00"] - 1  # 59

    prev_close = scan_all_closes(token, sub_id, active, open_pos, overrides)

    payload = compute_close_payload(token, sub_id, "correct")
    resp = api_post(f"/api/shifts/{main_id}/subshifts", payload, token, expected=(200,))
    sub_id = resp["new_subshift"]["shift_id"]
    new_pending = resp["new_subshift"]["pending_scans"]
    lt_label = f"${last_ticket_book['ticket_price']}" if last_ticket_book else "none"
    print(f"  [MS1-S2] Closed correct. Last-ticket: {lt_label}. Carried {resp['new_subshift']['carried_forward_count']}.")

    # Remove sold book from prev_close tracking
    if last_ticket_book:
        prev_close.pop(last_ticket_book["static_code"], None)

    # ---- Sub-shift 3 — return-to-vendor ----
    active = fetch_active_books(token)
    books_by_sc = {b["static_code"]: b for b in active}

    open_pos = {}
    pending_scs = {p["static_code"] for p in new_pending}
    for book in active:
        sc = book["static_code"]
        if sc in pending_scs:
            pos = book["start_position"]
            scan_open(token, sub_id, sc, pos)
        else:
            pos = prev_close.get(sc, book["start_position"])
        open_pos[sc] = pos

    n = random.randint(0, 2)
    for _ in range(n):
        do_whole_book_sale(token, sub_id, random.choice(list(LENGTH_BY_PRICE)))
    wbs_count += n

    # Return-to-vendor on a random active book
    active = fetch_active_books(token)
    if active:
        rtv_book = random.choice(active)
        sc = rtv_book["static_code"]
        op = open_pos.get(sc, rtv_book["start_position"])
        do_return_to_vendor(token, rtv_book, op)
        print(f"  [MS1-S3] Returned book {rtv_book['book_id']} (${rtv_book['ticket_price']}) to vendor.")

    # Close all remaining active books
    active = fetch_active_books(token)
    scan_all_closes(token, sub_id, active, open_pos)

    # Close main shift (closes final sub-shift + main)
    payload = compute_close_payload(token, sub_id, "correct")
    api_put(f"/api/shifts/{main_id}/close", payload, token, expected=(200,))
    print(f"  [MS1] Closed. WBS total this shift: {wbs_count}.")

    return main_id, last_ticket_book, rtv_book


# ---------------------------------------------------------------------------
# Main Shift 2 — Sub1 short ($1 last-ticket), Sub2 correct->voided, Sub3 correct ($20 last-ticket)
# ---------------------------------------------------------------------------

def run_main_shift_2(token: str) -> tuple[int, Optional[dict], int, Optional[dict]]:
    """Run Main Shift 2.

    Sub1: all pending, engineered $1.00 last-ticket, SHORT close (-$5).
    Sub2: all pending (no carry-forward), correct close -> immediately voided.
    Sub3: carry-forward from Sub2 before void; engineered $20.00 last-ticket; correct close -> main closed.

    Note on carry-forward after void: Sub2 closes correctly, triggering carry-forward
    into Sub3. Sub2 is then voided retroactively. Sub3's carried opens are unaffected
    by the void. When main closes, Sub2's totals are excluded from aggregation.

    Returns: (main_shift_id, last_ticket_1_book, sub2_id, last_ticket_2_book)
    """
    print("  [MS2] Opening main shift...")
    resp = api_post("/api/shifts", {}, token, expected=(201,))
    main_id: int = resp["main_shift"]["shift_id"]
    sub_id: int = resp["current_subshift"]["shift_id"]
    pending = resp["current_subshift"]["pending_scans"]

    wbs_count = 0
    lt1_book = None
    lt2_book = None

    # ---- Sub-shift 1 — SHORT, with $1 last-ticket ----
    # New main shift: all books pending. Open at start_position (convention).
    active = fetch_active_books(token)
    books_by_sc = {b["static_code"]: b for b in active}

    open_pos: dict[str, int] = {}
    for p in pending:
        sc = p["static_code"]
        book = books_by_sc.get(sc)
        if book:
            pos = book["start_position"]
            scan_open(token, sub_id, sc, pos)
            open_pos[sc] = pos

    n = random.randint(0, 2)
    for _ in range(n):
        do_whole_book_sale(token, sub_id, random.choice(list(LENGTH_BY_PRICE)))
    wbs_count += n

    active = fetch_active_books(token)
    lt1_book = _pick_last_ticket_book(active, "1.00", open_pos)
    overrides: dict[str, int] = {}
    if lt1_book:
        overrides[lt1_book["static_code"]] = LENGTH_BY_PRICE["1.00"] - 1  # 149

    prev_close = scan_all_closes(token, sub_id, active, open_pos, overrides)

    # SHORT close: sub1_id needed later for summary
    sub1_id = sub_id
    payload = compute_close_payload(token, sub_id, "short")
    resp = api_post(f"/api/shifts/{main_id}/subshifts", payload, token, expected=(200,))
    sub2_id = resp["new_subshift"]["shift_id"]
    new_pending = resp["new_subshift"]["pending_scans"]
    lt1_label = f"${lt1_book['ticket_price']}" if lt1_book else "none"
    print(f"  [MS2-S1] Closed SHORT. Last-ticket: {lt1_label}. Pending for S2: {len(new_pending)}.")

    if lt1_book:
        prev_close.pop(lt1_book["static_code"], None)

    # ---- Sub-shift 2 — CORRECT then VOIDED ----
    # No carry-forward from a short sub-shift — all books pending again.
    active = fetch_active_books(token)
    books_by_sc = {b["static_code"]: b for b in active}

    sub_id = sub2_id  # must be set before scanning opens on Sub2
    open_pos = {}
    pending_scs = {p["static_code"] for p in new_pending}
    for book in active:
        sc = book["static_code"]
        if sc in pending_scs:
            pos = book["start_position"]
            scan_open(token, sub_id, sc, pos)
        else:
            # Should not happen after a short close (no carry-forward), but handle gracefully
            pos = prev_close.get(sc, book["start_position"])
        open_pos[sc] = pos

    n = random.randint(0, 2)
    for _ in range(n):
        do_whole_book_sale(token, sub_id, random.choice(list(LENGTH_BY_PRICE)))
    wbs_count += n

    active = fetch_active_books(token)
    prev_close = scan_all_closes(token, sub_id, active, open_pos)

    payload = compute_close_payload(token, sub_id, "correct")
    # Handover: closes Sub2 correctly (triggering carry-forward into Sub3), opens Sub3
    resp = api_post(f"/api/shifts/{main_id}/subshifts", payload, token, expected=(200,))
    sub3_id = resp["new_subshift"]["shift_id"]
    new_pending = resp["new_subshift"]["pending_scans"]
    carried = resp["new_subshift"]["carried_forward_count"]
    print(f"  [MS2-S2] Closed correct. Carried {carried} books into S3. Voiding S2 now...")

    # Void Sub2 retroactively (it is now closed; Sub3 already has its carry-forward opens)
    api_post(
        f"/api/shifts/{main_id}/subshifts/{sub2_id}/void",
        {"reason": "Test seeder: voided sub-shift inside valid main shift"},
        token,
        expected=(200,),
    )
    print(f"  [MS2-S2] Voided sub-shift {sub2_id}.")

    # ---- Sub-shift 3 — $20 last-ticket, correct close ----
    # Note: carry-forward behavior after a voided sub-shift is implementation-dependent.
    # Sub2 closed correctly BEFORE being voided, so carry-forward into Sub3 already
    # occurred. Sub3's open scans (from carry-forward) are unaffected by the void.
    sub_id = sub3_id
    active = fetch_active_books(token)
    books_by_sc = {b["static_code"]: b for b in active}

    open_pos = {}
    pending_scs = {p["static_code"] for p in new_pending}
    for book in active:
        sc = book["static_code"]
        if sc in pending_scs:
            pos = book["start_position"]
            scan_open(token, sub_id, sc, pos)
        else:
            pos = prev_close.get(sc, book["start_position"])
        open_pos[sc] = pos

    n = random.randint(0, 2)
    for _ in range(n):
        do_whole_book_sale(token, sub_id, random.choice(list(LENGTH_BY_PRICE)))
    wbs_count += n

    active = fetch_active_books(token)
    lt2_book = _pick_last_ticket_book(active, "20.00", open_pos)
    overrides = {}
    if lt2_book:
        overrides[lt2_book["static_code"]] = LENGTH_BY_PRICE["20.00"] - 1  # 29

    scan_all_closes(token, sub_id, active, open_pos, overrides)

    payload = compute_close_payload(token, sub_id, "correct")
    api_put(f"/api/shifts/{main_id}/close", payload, token, expected=(200,))
    lt2_label = f"${lt2_book['ticket_price']}" if lt2_book else "none"
    print(f"  [MS2] Closed. Last-ticket S3: {lt2_label}. WBS this shift: {wbs_count}.")

    return main_id, lt1_book, sub2_id, lt2_book


# ---------------------------------------------------------------------------
# Main Shift 3 — correct, over, correct; entire main shift voided at end
# ---------------------------------------------------------------------------

def run_main_shift_3(token: str) -> int:
    """Run Main Shift 3.

    Sub1: correct close.
    Sub2: carry-forward, OVER close (+$3).
    Sub3: all pending (no carry-forward from over), correct close -> main closed.
    Then void the entire main shift.

    Returns: main_shift_id
    """
    print("  [MS3] Opening main shift...")
    resp = api_post("/api/shifts", {}, token, expected=(201,))
    main_id: int = resp["main_shift"]["shift_id"]
    sub_id: int = resp["current_subshift"]["shift_id"]
    pending = resp["current_subshift"]["pending_scans"]

    wbs_count = 0

    # ---- Sub-shift 1 — correct ----
    active = fetch_active_books(token)
    books_by_sc = {b["static_code"]: b for b in active}

    open_pos: dict[str, int] = {}
    for p in pending:
        sc = p["static_code"]
        book = books_by_sc.get(sc)
        if book:
            pos = book["start_position"]
            scan_open(token, sub_id, sc, pos)
            open_pos[sc] = pos

    n = random.randint(0, 2)
    for _ in range(n):
        do_whole_book_sale(token, sub_id, random.choice(list(LENGTH_BY_PRICE)))
    wbs_count += n

    active = fetch_active_books(token)
    prev_close = scan_all_closes(token, sub_id, active, open_pos)

    payload = compute_close_payload(token, sub_id, "correct")
    resp = api_post(f"/api/shifts/{main_id}/subshifts", payload, token, expected=(200,))
    sub_id = resp["new_subshift"]["shift_id"]
    new_pending = resp["new_subshift"]["pending_scans"]
    print(f"  [MS3-S1] Closed correct. Carried {resp['new_subshift']['carried_forward_count']}.")

    # ---- Sub-shift 2 — OVER close ----
    active = fetch_active_books(token)
    books_by_sc = {b["static_code"]: b for b in active}

    open_pos = {}
    pending_scs = {p["static_code"] for p in new_pending}
    for book in active:
        sc = book["static_code"]
        if sc in pending_scs:
            pos = book["start_position"]
            scan_open(token, sub_id, sc, pos)
        else:
            pos = prev_close.get(sc, book["start_position"])
        open_pos[sc] = pos

    n = random.randint(0, 2)
    for _ in range(n):
        do_whole_book_sale(token, sub_id, random.choice(list(LENGTH_BY_PRICE)))
    wbs_count += n

    active = fetch_active_books(token)
    scan_all_closes(token, sub_id, active, open_pos)

    payload = compute_close_payload(token, sub_id, "over")
    resp = api_post(f"/api/shifts/{main_id}/subshifts", payload, token, expected=(200,))
    sub_id = resp["new_subshift"]["shift_id"]
    new_pending = resp["new_subshift"]["pending_scans"]
    print(f"  [MS3-S2] Closed OVER (+$3). Pending for S3: {len(new_pending)}.")

    # ---- Sub-shift 3 — correct, then close main ----
    # No carry-forward from an over close; all books pending.
    active = fetch_active_books(token)
    books_by_sc = {b["static_code"]: b for b in active}

    open_pos = {}
    pending_scs = {p["static_code"] for p in new_pending}
    for book in active:
        sc = book["static_code"]
        if sc in pending_scs:
            pos = book["start_position"]
            scan_open(token, sub_id, sc, pos)
        else:
            pos = prev_close.get(sc, book["start_position"])  # shouldn't happen after 'over'
        open_pos[sc] = pos

    n = random.randint(0, 2)
    for _ in range(n):
        do_whole_book_sale(token, sub_id, random.choice(list(LENGTH_BY_PRICE)))
    wbs_count += n

    active = fetch_active_books(token)
    scan_all_closes(token, sub_id, active, open_pos)

    payload = compute_close_payload(token, sub_id, "correct")
    api_put(f"/api/shifts/{main_id}/close", payload, token, expected=(200,))
    print(f"  [MS3-S3] Closed correct. Main shift {main_id} closed. WBS: {wbs_count}.")

    # Void the entire main shift (cascades to all 3 sub-shifts)
    api_post(
        f"/api/shifts/{main_id}/void",
        {"reason": "Test seeder: entire main shift voided for testing"},
        token,
        expected=(200,),
    )
    print(f"  [MS3] Main shift {main_id} VOIDED (cascades to all 3 sub-shifts).")

    return main_id


# ---------------------------------------------------------------------------
# Startup logic
# ---------------------------------------------------------------------------

def ensure_assignment_state(token: Optional[str]) -> str:
    """Guarantee seeder A's assignment-phase state exists and return a valid token.

    When shifts exist (i.e. seeder B has run before), sold/returned book rows remain
    in the DB. Since seeder A reuses deterministic barcodes (seed 42), those rows
    cause BOOK_ALREADY_SOLD conflicts. A full wipe+setup is the only safe reset path.
    """
    if token is None:
        print("  Login failed — running fresh setup + seeder A.")
        token = seeder_a.setup_store_and_admin()
        seeder_a.seed_all_assignment_groups(token)
        return token

    shifts_data = api_get("/api/shifts", token)
    if shifts_data.get("total", 0) > 0 or shifts_data.get("shifts"):
        print("  Shifts found — wiping DB and re-seeding from scratch.")
        token = seeder_a.setup_store_and_admin()  # wipe + fresh setup
        seeder_a.seed_all_assignment_groups(token)
    else:
        print("  Store exists, no shifts — proceeding directly to shift seeding.")

    return token


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    start = time.monotonic()
    print(f"\nLottoMeter v2.0 — Seed: Shift Scenarios B")
    print(f"Target : {BASE_URL}\n")

    print("[1/5] Checking store state")
    token = seeder_a.login_seedadmin()
    token = ensure_assignment_state(token)

    random.seed(101)

    print("\n[2/5] Main Shift 1 (3 sub-shifts, all correct)")
    ms1_id, ms1_lt, ms1_rtv = run_main_shift_1(token)

    print("\n[3/5] Main Shift 2 (Sub1 short, Sub2 correct->voided, Sub3 correct)")
    ms2_id, ms2_lt1, ms2_sub2_id, ms2_lt2 = run_main_shift_2(token)

    print("\n[4/5] Main Shift 3 (correct, over, correct) -> voided")
    ms3_id = run_main_shift_3(token)

    elapsed = time.monotonic() - start

    ms1_lt_str = f"${ms1_lt['ticket_price']} book (id {ms1_lt['book_id']})" if ms1_lt else "none"
    ms2_lt1_str = f"${ms2_lt1['ticket_price']} book (id {ms2_lt1['book_id']})" if ms2_lt1 else "none"
    ms2_lt2_str = f"${ms2_lt2['ticket_price']} book (id {ms2_lt2['book_id']})" if ms2_lt2 else "none"
    rtv_str = f"book id {ms1_rtv['book_id']} (${ms1_rtv['ticket_price']})" if ms1_rtv else "none"

    print(f"""
[5/5] Done.

OK Seeder B complete
OK Main Shift 1 (id {ms1_id}): 3 sub-shifts, all correct, main closed correct
OK Main Shift 2 (id {ms2_id}): Sub1 SHORT, Sub2 {ms2_sub2_id} VOIDED, Sub3 correct, main closed correct
OK Main Shift 3 (id {ms3_id}): Sub1 correct, Sub2 OVER, Sub3 correct — MAIN SHIFT VOIDED
OK Last-ticket events:
     MS1-Sub2 : {ms1_lt_str}
     MS2-Sub1 : {ms2_lt1_str}
     MS2-Sub3 : {ms2_lt2_str}
OK Return-to-vendor: {rtv_str}
OK Total sub-shifts created: 9
OK Voided: sub-shift {ms2_sub2_id} + all 3 sub-shifts of Main Shift {ms3_id}
Total elapsed: {elapsed:.1f} seconds""")


if __name__ == "__main__":
    main()
