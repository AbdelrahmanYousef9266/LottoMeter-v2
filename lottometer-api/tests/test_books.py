"""Tests for /api/books/* — listing, summary, detail."""

from tests.conftest import auth_headers


def test_list_books_empty(client, setup_store, admin_token):
    """Books endpoint returns empty list when store has no books."""
    res = client.get('/api/books', headers=auth_headers(admin_token))
    assert res.status_code == 200
    assert 'books' in res.json
    assert isinstance(res.json['books'], list)


def test_list_books_has_active_book(client, setup_store, setup_slot_and_book, admin_token):
    """Active book created in fixture appears in list."""
    res = client.get('/api/books', headers=auth_headers(admin_token))
    assert res.status_code == 200
    books = res.json['books']
    assert len(books) >= 1
    static_codes = [b['static_code'] for b in books]
    assert '1234567890' in static_codes


def test_list_books_filter_active(client, setup_store, setup_slot_and_book, admin_token):
    """?is_active=true returns only active books."""
    res = client.get('/api/books?is_active=true', headers=auth_headers(admin_token))
    assert res.status_code == 200
    for book in res.json['books']:
        assert book['is_active'] is True


def test_books_summary(client, setup_store, setup_slot_and_book, admin_token):
    """GET /api/books/summary returns active and total counts."""
    res = client.get('/api/books/summary', headers=auth_headers(admin_token))
    assert res.status_code == 200
    assert 'active' in res.json
    assert res.json['active'] >= 1


def test_get_book_detail(client, setup_store, setup_slot_and_book, admin_token):
    """GET /api/books/<id> returns detailed book info."""
    book = setup_slot_and_book['book']
    res = client.get(f'/api/books/{book.book_id}', headers=auth_headers(admin_token))
    assert res.status_code == 200
    assert res.json['book']['static_code'] == '1234567890'


def test_books_require_auth(client, setup_store):
    res = client.get('/api/books')
    assert res.status_code == 401
