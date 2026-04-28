#!/usr/bin/env python3
"""LottoMeter v2.0 — Seeder A: Assignment-Phase Edge Cases

Importable functions:
  login_seedadmin()          — returns admin JWT or None
  setup_store_and_admin()    — wipe DB + create store, returns admin JWT
  reset_store(token)         — void shifts, unassign books, delete slots/extra users
  seed_all_assignment_groups(token) — bulk-create 60 slots + run all 5 groups

CLI: python scripts/seed_edge_cases_a.py  (full reset + reseed)

Requires: requests
"""

import os
import sys
import time
import random
import string
from typing import NoReturn, Optional

import requests

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL: str = os.environ.get("LOTTOMETER_API_URL", "http://localhost:5000").rstrip("/")

STORE_CODE = "SEED-EDGE-A"
STORE_NAME = "Seed Edge A"
ADMIN_USERNAME = "seedadmin"
ADMIN_PASSWORD = "seedpass123"
STORE_PIN = "1234"

LENGTH_BY_PRICE: dict[str, int] = {
    "1.00": 150,
    "2.00": 150,
    "3.00": 100,
    "5.00": 60,
    "10.00": 30,
    "20.00": 30,
}

SLOT_TIERS: list[dict] = [
    {"count": 10, "ticket_price": "1.00"},
    {"count": 10, "ticket_price": "2.00"},
    {"count": 10, "ticket_price": "3.00"},
    {"count": 10, "ticket_price": "5.00"},
    {"count": 10, "ticket_price": "10.00"},
    {"count": 10, "ticket_price": "20.00"},
]

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _headers(token: Optional[str] = None) -> dict:
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def api_post(
    path: str,
    body: dict,
    token: Optional[str] = None,
    expected: tuple[int, ...] = (200, 201),
) -> dict:
    url = f"{BASE_URL}{path}"
    resp = requests.post(url, json=body, headers=_headers(token))
    if resp.status_code not in expected:
        _abort(path, body, resp)
    return resp.json() if resp.content else {}


def api_get(
    path: str,
    token: str,
    params: Optional[dict] = None,
) -> dict:
    url = f"{BASE_URL}{path}"
    resp = requests.get(url, headers=_headers(token), params=params)
    if resp.status_code != 200:
        _abort(path, {}, resp)
    return resp.json()


def api_delete(
    path: str,
    token: str,
    expected: tuple[int, ...] = (204,),
) -> None:
    url = f"{BASE_URL}{path}"
    resp = requests.delete(url, headers=_headers(token))
    if resp.status_code not in expected:
        _abort(path, {}, resp)


def _abort(path: str, payload: dict, resp: requests.Response) -> NoReturn:
    print(f"\nX Unexpected response from {path}")
    print(f"  Payload : {payload}")
    print(f"  Status  : {resp.status_code}")
    try:
        print(f"  Body    : {resp.json()}")
    except Exception:
        print(f"  Body    : {resp.text!r}")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Barcode helpers
# ---------------------------------------------------------------------------

def random_static_code(used: set[str]) -> str:
    while True:
        code = "".join(random.choices(string.digits, k=10))
        if code not in used:
            used.add(code)
            return code


def format_barcode(static_code: str, position: int) -> str:
    return f"{static_code}{position:03d}"


# ---------------------------------------------------------------------------
# Auth / wipe
# ---------------------------------------------------------------------------

def login_seedadmin() -> Optional[str]:
    """Try to log in as seedadmin. Returns JWT on success, None on failure."""
    try:
        resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "store_code": STORE_CODE,
                "username": ADMIN_USERNAME,
                "password": ADMIN_PASSWORD,
            },
            headers=_headers(),
        )
    except requests.exceptions.ConnectionError:
        return None
    if resp.status_code == 200:
        return resp.json()["token"]
    return None


def setup_store_and_admin() -> str:
    """Wipe the database and run first-time setup. Returns admin JWT.

    Requires the server to be running with DEBUG=True (exposes /api/dev/wipe).
    """
    wipe_resp = requests.post(f"{BASE_URL}/api/dev/wipe", headers=_headers())
    if wipe_resp.status_code == 403:
        print("\nX /api/dev/wipe requires DEBUG=True on the server.")
        sys.exit(1)
    if wipe_resp.status_code != 200:
        _abort("/api/dev/wipe", {}, wipe_resp)
    print("  -> Database wiped.")

    setup_resp = requests.post(
        f"{BASE_URL}/api/auth/setup",
        json={
            "store_name": STORE_NAME,
            "store_code": STORE_CODE,
            "admin_username": ADMIN_USERNAME,
            "admin_password": ADMIN_PASSWORD,
            "store_pin": STORE_PIN,
        },
        headers=_headers(),
    )
    if setup_resp.status_code != 201:
        _abort("/api/auth/setup", {}, setup_resp)
    print(f"  -> Store created: '{STORE_NAME}' ({STORE_CODE}).")
    return setup_resp.json()["token"]


def reset_store(token: str) -> None:
    """Clear all mutable state via API (shifts, books, slots, extra users).

    Safe to call on a backend that has run seeder B; handles open shifts first.
    """
    # 0. Void any open main shifts before touching books or slots.
    shifts_data = api_get("/api/shifts", token)
    open_shifts = [
        s for s in shifts_data.get("shifts", [])
        if s["is_shift_open"] and not s["voided"]
    ]
    for shift in open_shifts:
        api_post(
            f"/api/shifts/{shift['shift_id']}/void",
            {"reason": "Seeder reset"},
            token,
            expected=(200,),
        )
    if open_shifts:
        print(f"  -> Voided {len(open_shifts)} open shift(s).")

    # 1. Unassign all active books (empties slots so bulk-delete can proceed).
    books_data = api_get("/api/books", token, params={"is_active": "true"})
    active_books = [b for b in books_data.get("books", []) if b.get("is_active")]
    for book in active_books:
        api_post(f"/api/books/{book['book_id']}/unassign", {}, token, expected=(200,))
    if active_books:
        print(f"  -> Unassigned {len(active_books)} active book(s).")

    # 2. Bulk-soft-delete all non-deleted slots.
    slots_data = api_get("/api/slots", token)
    slot_ids = [s["slot_id"] for s in slots_data.get("slots", [])]
    if slot_ids:
        result = api_post(
            "/api/slots/bulk-delete",
            {"slot_ids": slot_ids},
            token,
            expected=(200,),
        )
        print(f"  -> Deleted {result.get('deleted_count', len(slot_ids))} slot(s).")

    # 3. Soft-delete extra users (preserve seedadmin).
    users_data = api_get("/api/users", token)
    extra_users = [
        u for u in users_data.get("users", [])
        if u["username"] != ADMIN_USERNAME and u.get("deleted_at") is None
    ]
    for user in extra_users:
        api_delete(f"/api/users/{user['user_id']}", token)
    if extra_users:
        print(f"  -> Soft-deleted {len(extra_users)} extra user(s).")


# ---------------------------------------------------------------------------
# Slot creation
# ---------------------------------------------------------------------------

def create_slots(token: str) -> list[dict]:
    result = api_post(
        "/api/slots/bulk",
        {"tiers": SLOT_TIERS},
        token,
        expected=(201,),
    )
    slots = result["slots"]
    print(f"  -> Created {len(slots)} slots.")
    return slots


# ---------------------------------------------------------------------------
# Group seed functions
# ---------------------------------------------------------------------------

def seed_group_1_fresh(token: str, slots: list[dict], used_codes: set[str]) -> list[int]:
    chosen = random.sample(slots, 40)
    for slot in chosen:
        code = random_static_code(used_codes)
        barcode = format_barcode(code, 0)
        api_post(
            f"/api/slots/{slot['slot_id']}/assign-book",
            {"barcode": barcode, "confirm_reassign": False},
            token,
            expected=(201,),
        )
    print(f"  -> Group 1: {len(chosen)} books assigned at position 0.")
    return [s["slot_id"] for s in chosen]


def seed_group_2_nonzero_position(
    token: str, slots: list[dict], used_codes: set[str]
) -> list[int]:
    chosen = random.sample(slots, 5)
    for slot in chosen:
        price = slot["ticket_price"]
        length = LENGTH_BY_PRICE[price]
        position = random.randint(1, length - 1)
        code = random_static_code(used_codes)
        barcode = format_barcode(code, position)
        api_post(
            f"/api/slots/{slot['slot_id']}/assign-book",
            {"barcode": barcode, "confirm_reassign": False},
            token,
            expected=(201,),
        )
    print(f"  -> Group 2: {len(chosen)} books assigned at non-zero positions.")
    return [s["slot_id"] for s in chosen]


def seed_group_3_reassigned(
    token: str, slots: list[dict], used_codes: set[str]
) -> list[int]:
    chosen = random.sample(slots, 10)
    slot_as, slot_bs = chosen[:5], chosen[5:]
    for slot_a, slot_b in zip(slot_as, slot_bs):
        code = random_static_code(used_codes)
        barcode = format_barcode(code, 0)
        api_post(
            f"/api/slots/{slot_a['slot_id']}/assign-book",
            {"barcode": barcode, "confirm_reassign": False},
            token, expected=(201,),
        )
        api_post(
            f"/api/slots/{slot_b['slot_id']}/assign-book",
            {"barcode": barcode, "confirm_reassign": True},
            token, expected=(201,),
        )
    print("  -> Group 3: 5 books reassigned (5 slot_As empty, 5 slot_Bs occupied).")
    return [s["slot_id"] for s in chosen]


def seed_group_4_unassigned(
    token: str, slots: list[dict], used_codes: set[str]
) -> list[int]:
    for slot in slots:
        code = random_static_code(used_codes)
        barcode = format_barcode(code, 0)
        result = api_post(
            f"/api/slots/{slot['slot_id']}/assign-book",
            {"barcode": barcode, "confirm_reassign": False},
            token, expected=(201,),
        )
        api_post(
            f"/api/books/{result['book']['book_id']}/unassign",
            {}, token, expected=(200,),
        )
    print(f"  -> Group 4: {len(slots)} books assigned then unassigned.")
    return [s["slot_id"] for s in slots]


def seed_group_5_soft_deleted_slots(token: str, used_codes: set[str]) -> None:
    result = api_post(
        "/api/slots/bulk",
        {
            "tiers": [
                {"count": 1, "ticket_price": "1.00"},
                {"count": 1, "ticket_price": "5.00"},
                {"count": 1, "ticket_price": "10.00"},
                {"count": 1, "ticket_price": "2.00"},
                {"count": 1, "ticket_price": "20.00"},
            ]
        },
        token, expected=(201,),
    )
    extra_slots = result["slots"]
    for slot in extra_slots[:2]:
        api_delete(f"/api/slots/{slot['slot_id']}", token, expected=(204,))
    for slot in extra_slots[2:]:
        code = random_static_code(used_codes)
        assign = api_post(
            f"/api/slots/{slot['slot_id']}/assign-book",
            {"barcode": format_barcode(code, 0), "confirm_reassign": False},
            token, expected=(201,),
        )
        api_post(f"/api/books/{assign['book']['book_id']}/unassign", {}, token, expected=(200,))
        api_delete(f"/api/slots/{slot['slot_id']}", token, expected=(204,))
    print("  -> Group 5: 5 extra slots created and soft-deleted.")


# ---------------------------------------------------------------------------
# Public importable entry points
# ---------------------------------------------------------------------------

def seed_all_assignment_groups(token: str) -> None:
    """Bulk-create 60 slots and run all 5 assignment-phase groups.

    Sets random.seed(42) for reproducibility; safe to call from other seeders.
    """
    random.seed(42)
    print("\n[2/4] Creating 60 main slots")
    all_slots = create_slots(token)

    print("\n[3/4] Distributing books across groups")
    used_codes: set[str] = set()
    remaining = list(all_slots)

    g1_ids = set(seed_group_1_fresh(token, remaining, used_codes))
    remaining = [s for s in remaining if s["slot_id"] not in g1_ids]

    g2_ids = set(seed_group_2_nonzero_position(token, remaining, used_codes))
    remaining = [s for s in remaining if s["slot_id"] not in g2_ids]

    g3_ids = set(seed_group_3_reassigned(token, remaining, used_codes))
    remaining = [s for s in remaining if s["slot_id"] not in g3_ids]

    seed_group_4_unassigned(token, remaining, used_codes)

    print("\n[4/4] Soft-deleted extra slots (Slot 61-65)")
    seed_group_5_soft_deleted_slots(token, used_codes)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    start = time.monotonic()
    print(f"\nLottoMeter v2.0 — Seed: Edge Cases A")
    print(f"Target : {BASE_URL}\n")

    print("[1/4] Wipe & setup")
    token = setup_store_and_admin()

    seed_all_assignment_groups(token)

    elapsed = time.monotonic() - start
    print(f"""
OK Store: {STORE_NAME} ({STORE_CODE})
OK Admin: {ADMIN_USERNAME}
OK Slots created: 65 (60 active + 5 soft-deleted)
OK Books seeded: 55 total (50 active in slots, 5 inactive)
OK Edge cases:
   - 40 fresh at position 0
   - 5 assigned at non-zero start_position
   - 5 reassigned (history trail)
   - 5 unassigned (slot empty, book preserved)
   - 5 empty slots from reassignments
   - 2 soft-deleted slots (never held a book)
   - 3 soft-deleted slots (with history)
Total elapsed: {elapsed:.1f} seconds""")


if __name__ == "__main__":
    main()
