"""Tests for POST /api/scan — all 8 scan rules.

Book setup: static_code='1234567890', ticket_price=$5.00
  → 60 tickets, valid positions 0–59
  → barcode format: static_code + 3-digit zero-padded position
     e.g. position 15 → '1234567890015'
"""

from tests.conftest import auth_headers, open_shift, do_scan


# ── Rule 1: book must exist ───────────────────────────────────────────────────

def test_scan_book_not_found(client, setup_store, admin_token):
    shift = open_shift(client, admin_token)
    res = do_scan(client, admin_token, shift['id'], '9999999990000', 'open')
    assert res.status_code == 404
    assert res.json['error']['code'] == 'BOOK_NOT_FOUND'


# ── Rule 2 / 3: book must be active and not sold ──────────────────────────────

def test_scan_book_not_active(client, setup_store, setup_slot_and_book, admin_token):
    """Scanning a book that exists but is inactive raises BOOK_NOT_ACTIVE."""
    from app.extensions import db
    from app.models.book import Book

    book = setup_slot_and_book['book']
    # Mark book inactive (returned / unassigned from slot)
    Book.query.filter_by(book_id=book.book_id).update({'is_active': False, 'slot_id': None})
    db.session.commit()

    shift = open_shift(client, admin_token)
    res = do_scan(client, admin_token, shift['id'], '1234567890015', 'open')
    assert res.status_code == 422
    assert res.json['error']['code'] == 'BOOK_NOT_ACTIVE'


# ── Rule 5: duplicate open scan overwrites (no error) ────────────────────────

def test_scan_duplicate_open_is_overwrite(client, setup_store, setup_slot_and_book, admin_token):
    """A second open scan for the same book in the same shift overwrites the first."""
    shift = open_shift(client, admin_token)

    # First open scan at position 10
    r1 = do_scan(client, admin_token, shift['id'], '1234567890010', 'open')
    assert r1.status_code == 200
    assert r1.json['scan']['start_at_scan'] == 10

    # Second open scan at position 15 — should overwrite, not error
    r2 = do_scan(client, admin_token, shift['id'], '1234567890015', 'open')
    assert r2.status_code == 200
    assert r2.json['scan']['start_at_scan'] == 15


# ── Rule 6 (code): position must be in valid range ────────────────────────────

def test_scan_position_out_of_range(client, setup_store, setup_slot_and_book, admin_token):
    """Position 99 exceeds book length of 60 for $5 books → INVALID_POSITION."""
    shift = open_shift(client, admin_token)
    res = do_scan(client, admin_token, shift['id'], '1234567890099', 'open')
    assert res.status_code == 400
    assert res.json['error']['code'] == 'INVALID_POSITION'


# ── Rule 7: close scan requires a prior open scan ─────────────────────────────

def test_scan_close_without_open(client, setup_store, setup_slot_and_book, admin_token):
    """Close scan with no prior open scan → NO_OPEN_SCAN."""
    shift = open_shift(client, admin_token)
    res = do_scan(client, admin_token, shift['id'], '1234567890020', 'close')
    assert res.status_code == 422
    assert res.json['error']['code'] == 'NO_OPEN_SCAN'


# ── Rule 7: close position must be >= open position ──────────────────────────

def test_scan_close_position_before_open(client, setup_store, setup_slot_and_book, admin_token):
    """Close at position 20 after open at position 30 → POSITION_BEFORE_OPEN."""
    shift = open_shift(client, admin_token)

    r_open = do_scan(client, admin_token, shift['id'], '1234567890030', 'open')
    assert r_open.status_code == 200

    r_close = do_scan(client, admin_token, shift['id'], '1234567890020', 'close')
    assert r_close.status_code == 400
    assert r_close.json['error']['code'] == 'POSITION_BEFORE_OPEN'


# ── Happy paths ───────────────────────────────────────────────────────────────

def test_scan_open_success(client, setup_store, setup_slot_and_book, admin_token):
    shift = open_shift(client, admin_token)
    res = do_scan(client, admin_token, shift['id'], '1234567890015', 'open')
    assert res.status_code == 200
    assert res.json['scan']['scan_type'] == 'open'
    assert res.json['scan']['start_at_scan'] == 15
    assert 'book' in res.json
    assert 'running_totals' in res.json


def test_scan_close_success(client, setup_store, setup_slot_and_book, admin_token):
    shift = open_shift(client, admin_token)

    r_open = do_scan(client, admin_token, shift['id'], '1234567890010', 'open')
    assert r_open.status_code == 200

    r_close = do_scan(client, admin_token, shift['id'], '1234567890020', 'close')
    assert r_close.status_code == 200
    assert r_close.json['scan']['scan_type'] == 'close'
    assert r_close.json['scan']['start_at_scan'] == 20


def test_scan_requires_auth(client, setup_store, setup_slot_and_book):
    res = client.post('/api/scan', json={
        'shift_id': 999,
        'barcode': '1234567890015',
        'scan_type': 'open',
    })
    assert res.status_code == 401
