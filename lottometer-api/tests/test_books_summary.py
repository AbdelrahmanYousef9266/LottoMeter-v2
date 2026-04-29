"""Tests for GET /api/books/summary."""

import pytest
from datetime import datetime, timezone
from flask_jwt_extended import create_access_token

from app import create_app
from app.extensions import db as _db
from app.models.store import Store
from app.models.user import User
from app.models.book import Book


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def app():
    app = create_app("testing")
    with app.app_context():
        _db.create_all()
        yield app
        _db.drop_all()


@pytest.fixture(scope="module")
def client(app):
    return app.test_client()


@pytest.fixture(scope="module")
def ctx(app):
    """Create two stores, seed books, and return auth headers per store."""
    with app.app_context():
        store_a = Store(store_name="Store A", store_code="SA001")
        store_b = Store(store_name="Store B", store_code="SB001")
        _db.session.add_all([store_a, store_b])
        _db.session.flush()

        user_a = User(
            store_id=store_a.store_id,
            username="admin_a",
            password_hash="hashed",
            role="admin",
        )
        user_b = User(
            store_id=store_b.store_id,
            username="admin_b",
            password_hash="hashed",
            role="admin",
        )
        _db.session.add_all([user_a, user_b])
        _db.session.flush()

        _returned_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

        # Store A books:
        #   2 active  (is_active=True,  is_sold=False, returned_at=None)
        #   1 sold    (is_sold=True)
        #   1 returned (returned_at set)
        books_a = [
            Book(store_id=store_a.store_id, barcode="1000000000001",
                 static_code="1000000000", is_active=True,  is_sold=False),
            Book(store_id=store_a.store_id, barcode="1000000001001",
                 static_code="1000000001", is_active=True,  is_sold=False),
            Book(store_id=store_a.store_id, barcode="2000000000001",
                 static_code="2000000000", is_active=False, is_sold=True),
            Book(store_id=store_a.store_id, barcode="3000000000001",
                 static_code="3000000000", is_active=False, is_sold=False,
                 returned_at=_returned_at),
        ]
        # Store B: 1 active book — must never bleed into store A's counts
        books_b = [
            Book(store_id=store_b.store_id, barcode="9000000000001",
                 static_code="9000000000", is_active=True, is_sold=False),
        ]
        _db.session.add_all(books_a + books_b)
        _db.session.commit()

        token_a = create_access_token(
            identity=str(user_a.user_id),
            additional_claims={"role": "admin", "store_id": store_a.store_id},
        )
        token_b = create_access_token(
            identity=str(user_b.user_id),
            additional_claims={"role": "admin", "store_id": store_b.store_id},
        )

        return {
            "header_a": {"Authorization": f"Bearer {token_a}"},
            "header_b": {"Authorization": f"Bearer {token_b}"},
        }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_summary_counts_correct(client, ctx):
    resp = client.get("/api/books/summary", headers=ctx["header_a"])
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["active"] == 2
    assert data["sold"] == 1
    assert data["returned"] == 1
    assert data["total"] == 4


def test_summary_response_shape(client, ctx):
    resp = client.get("/api/books/summary", headers=ctx["header_a"])
    data = resp.get_json()
    assert set(data.keys()) == {"active", "sold", "returned", "total"}
    assert all(isinstance(v, int) for v in data.values())


def test_summary_requires_auth(client):
    resp = client.get("/api/books/summary")
    assert resp.status_code == 401


def test_summary_multi_tenancy_isolation(client, ctx):
    """Store B's book must not appear in store A's summary."""
    resp_a = client.get("/api/books/summary", headers=ctx["header_a"])
    resp_b = client.get("/api/books/summary", headers=ctx["header_b"])

    assert resp_a.status_code == 200
    assert resp_b.status_code == 200

    data_a = resp_a.get_json()
    data_b = resp_b.get_json()

    assert data_a["total"] == 4   # store A's 4 books only
    assert data_b["total"] == 1   # store B's 1 book only
    assert data_a["active"] == 2
    assert data_b["active"] == 1
