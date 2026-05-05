"""Tests for /api/business-days/* — lifecycle and ticket breakdown."""

from tests.conftest import auth_headers, open_shift


def test_get_today_creates_business_day(client, setup_store, admin_token):
    """GET /api/business-days/today auto-creates a day if none exists."""
    res = client.get('/api/business-days/today', headers=auth_headers(admin_token))
    assert res.status_code == 200
    bd = res.json['business_day']
    assert bd['status'] == 'open'
    assert 'id' in bd


def test_get_today_idempotent(client, setup_store, admin_token):
    """Calling today twice returns the same business day."""
    res1 = client.get('/api/business-days/today', headers=auth_headers(admin_token))
    res2 = client.get('/api/business-days/today', headers=auth_headers(admin_token))
    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res1.json['business_day']['id'] == res2.json['business_day']['id']


def test_list_business_days(client, setup_store, admin_token):
    client.get('/api/business-days/today', headers=auth_headers(admin_token))
    res = client.get('/api/business-days', headers=auth_headers(admin_token))
    assert res.status_code == 200
    assert isinstance(res.json['business_days'], list)
    assert len(res.json['business_days']) >= 1


def test_get_business_day_by_id(client, setup_store, admin_token):
    today_res = client.get('/api/business-days/today', headers=auth_headers(admin_token))
    day_id = today_res.json['business_day']['id']

    res = client.get(f'/api/business-days/{day_id}', headers=auth_headers(admin_token))
    assert res.status_code == 200
    assert res.json['business_day']['id'] == day_id


def test_close_day_with_open_shifts(client, setup_store, admin_token):
    """Cannot close business day while an employee shift is still open."""
    today_res = client.get('/api/business-days/today', headers=auth_headers(admin_token))
    day_id = today_res.json['business_day']['id']

    open_shift(client, admin_token)   # leaves an open shift

    res = client.post(f'/api/business-days/{day_id}/close',
        headers=auth_headers(admin_token))
    assert res.status_code == 422
    assert res.json['error']['code'] == 'OPEN_SHIFTS_REMAIN'


def test_ticket_breakdown_empty(client, setup_store, admin_token):
    """Breakdown returns empty list when no scans recorded."""
    today_res = client.get('/api/business-days/today', headers=auth_headers(admin_token))
    day_id = today_res.json['business_day']['id']

    res = client.get(f'/api/business-days/{day_id}/ticket-breakdown',
        headers=auth_headers(admin_token))
    assert res.status_code == 200
    assert res.json['breakdown'] == []
    assert res.json['total_tickets'] == 0


def test_business_day_requires_auth(client, setup_store):
    res = client.get('/api/business-days/today')
    assert res.status_code == 401
