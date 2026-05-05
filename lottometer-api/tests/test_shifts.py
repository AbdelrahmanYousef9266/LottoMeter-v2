"""Tests for /api/shifts/* — open, close, duplicate guard, financial calc.

Shift close formula:
  tickets_total = sum of (close_pos - open_pos) × ticket_price per book
  expected_cash = gross_sales + tickets_total - cash_out - cancels
  difference    = cash_in_hand - expected_cash
  shift_status  = 'correct' | 'over' | 'short'
"""

from tests.conftest import auth_headers, open_shift, do_scan


def close_shift(client, token, shift_id, cash_in, gross='0.00', cash_out='0.00', cancels='0.00'):
    return client.put(f'/api/shifts/{shift_id}/close', json={
        'cash_in_hand': cash_in,
        'gross_sales':  gross,
        'cash_out':     cash_out,
        'cancels':      cancels,
    }, headers=auth_headers(token))


# ── Open shift ────────────────────────────────────────────────────────────────

def test_open_shift_success(client, setup_store, admin_token):
    res = client.post('/api/shifts', headers=auth_headers(admin_token))
    assert res.status_code == 201
    shift = res.json['employee_shift']
    assert shift['status'] == 'open'
    assert shift['shift_number'] == 1


def test_open_shift_duplicate(client, setup_store, admin_token):
    """Cannot open a second shift while one is already open."""
    client.post('/api/shifts', headers=auth_headers(admin_token))
    res = client.post('/api/shifts', headers=auth_headers(admin_token))
    assert res.status_code == 409
    assert res.json['error']['code'] == 'SHIFT_ALREADY_OPEN'


def test_open_shift_requires_auth(client, setup_store):
    res = client.post('/api/shifts')
    assert res.status_code == 401


# ── Close shift calculations ──────────────────────────────────────────────────

def test_close_shift_correct(client, setup_store, setup_slot_and_book, admin_token):
    """
    Open at pos 10, close at pos 20 → 10 tickets × $5 = $50 tickets_total.
    cash_in=50, gross=0, cash_out=0, cancels=0
    → expected_cash = 0 + 50 - 0 - 0 = 50
    → difference = 50 - 50 = 0 → correct
    """
    shift = open_shift(client, admin_token)

    do_scan(client, admin_token, shift['id'], '1234567890010', 'open')
    do_scan(client, admin_token, shift['id'], '1234567890020', 'close')

    res = close_shift(client, admin_token, shift['id'], cash_in='50.00')
    assert res.status_code == 200
    data = res.json['shift']
    assert float(data['tickets_total']) == 50.00
    assert float(data['expected_cash']) == 50.00
    assert float(data['difference']) == 0.00
    assert data['shift_status'] == 'correct'
    assert data['status'] == 'closed'


def test_close_shift_short(client, setup_store, setup_slot_and_book, admin_token):
    """
    Same 10 tickets × $5 = $50 tickets_total.
    cash_in=40 → expected_cash=50, difference=-10 → short.
    """
    shift = open_shift(client, admin_token)

    do_scan(client, admin_token, shift['id'], '1234567890010', 'open')
    do_scan(client, admin_token, shift['id'], '1234567890020', 'close')

    res = close_shift(client, admin_token, shift['id'], cash_in='40.00')
    assert res.status_code == 200
    data = res.json['shift']
    assert data['shift_status'] == 'short'
    assert float(data['difference']) == -10.00


def test_close_shift_over(client, setup_store, setup_slot_and_book, admin_token):
    """
    Same 10 tickets × $5 = $50 tickets_total.
    cash_in=60 → expected_cash=50, difference=+10 → over.
    """
    shift = open_shift(client, admin_token)

    do_scan(client, admin_token, shift['id'], '1234567890010', 'open')
    do_scan(client, admin_token, shift['id'], '1234567890020', 'close')

    res = close_shift(client, admin_token, shift['id'], cash_in='60.00')
    assert res.status_code == 200
    data = res.json['shift']
    assert data['shift_status'] == 'over'
    assert float(data['difference']) == 10.00


def test_close_shift_missing_book_close_scan(client, setup_store, setup_slot_and_book, admin_token):
    """Cannot close shift when an active book has no close scan."""
    shift = open_shift(client, admin_token)
    # Scan book open only — no close scan
    do_scan(client, admin_token, shift['id'], '1234567890010', 'open')

    res = close_shift(client, admin_token, shift['id'], cash_in='0.00')
    assert res.status_code == 422
    assert res.json['error']['code'] == 'BOOKS_NOT_CLOSED'


# ── Void shift ────────────────────────────────────────────────────────────────

def test_void_shift(client, setup_store, admin_token):
    shift = open_shift(client, admin_token)
    res = client.post(f'/api/shifts/{shift["id"]}/void',
        json={'reason': 'Testing void'},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200
    assert res.json['shift']['voided'] is True


# ── List shifts ───────────────────────────────────────────────────────────────

def test_list_shifts(client, setup_store, admin_token):
    open_shift(client, admin_token)
    res = client.get('/api/shifts', headers=auth_headers(admin_token))
    assert res.status_code == 200
    assert isinstance(res.json['shifts'], list)
    assert len(res.json['shifts']) >= 1
