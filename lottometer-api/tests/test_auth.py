"""Tests for /api/auth/* endpoints."""

from tests.conftest import auth_headers


def test_login_success(client, setup_store):
    res = client.post('/api/auth/login', json={
        'store_code': 'TEST01',
        'username': 'admin',
        'password': 'admin1234',
    })
    assert res.status_code == 200
    assert 'token' in res.json


def test_login_wrong_password(client, setup_store):
    res = client.post('/api/auth/login', json={
        'store_code': 'TEST01',
        'username': 'admin',
        'password': 'wrongpassword',
    })
    assert res.status_code == 401
    assert res.json['error']['code'] == 'INVALID_CREDENTIALS'


def test_login_wrong_store(client, setup_store):
    res = client.post('/api/auth/login', json={
        'store_code': 'BADSTORE',
        'username': 'admin',
        'password': 'admin1234',
    })
    assert res.status_code == 401
    assert res.json['error']['code'] == 'INVALID_CREDENTIALS'


def test_login_missing_fields(client, setup_store):
    res = client.post('/api/auth/login', json={'store_code': 'TEST01'})
    assert res.status_code == 400


def test_login_employee_success(client, setup_store):
    res = client.post('/api/auth/login', json={
        'store_code': 'TEST01',
        'username': 'employee',
        'password': 'emp1234',
    })
    assert res.status_code == 200
    assert 'token' in res.json


def test_change_password_success(client, setup_store, admin_token):
    res = client.put('/api/auth/change-password',
        json={
            'current_password': 'admin1234',
            'new_password': 'newpass1234',
            'confirm_password': 'newpass1234',
        },
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200
    assert 'message' in res.json


def test_change_password_wrong_current(client, setup_store, admin_token):
    # WRONG_PASSWORD raises ValidationError → 400
    res = client.put('/api/auth/change-password',
        json={
            'current_password': 'notmypassword',
            'new_password': 'newpass1234',
            'confirm_password': 'newpass1234',
        },
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 400
    assert res.json['error']['code'] == 'WRONG_PASSWORD'


def test_change_password_mismatch(client, setup_store, admin_token):
    # PASSWORD_MISMATCH raises ValidationError → 400
    res = client.put('/api/auth/change-password',
        json={
            'current_password': 'admin1234',
            'new_password': 'newpass1234',
            'confirm_password': 'different9999',
        },
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 400
    assert res.json['error']['code'] == 'PASSWORD_MISMATCH'


def test_change_password_too_short(client, setup_store, admin_token):
    # PASSWORD_TOO_SHORT raises ValidationError → 400
    res = client.put('/api/auth/change-password',
        json={
            'current_password': 'admin1234',
            'new_password': 'short',
            'confirm_password': 'short',
        },
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 400
    assert res.json['error']['code'] == 'PASSWORD_TOO_SHORT'


def test_change_password_requires_auth(client, setup_store):
    res = client.put('/api/auth/change-password', json={
        'current_password': 'admin1234',
        'new_password': 'newpass1234',
        'confirm_password': 'newpass1234',
    })
    assert res.status_code == 401


def test_me_endpoint(client, setup_store, admin_token):
    res = client.get('/api/auth/me', headers=auth_headers(admin_token))
    assert res.status_code == 200
    assert res.json['role'] == 'admin'
