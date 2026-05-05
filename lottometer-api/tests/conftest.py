"""Shared fixtures for the LottoMeter API test suite."""

import pytest
import bcrypt

from app import create_app
from app.extensions import db as _db
from app.models.store import Store
from app.models.user import User
from app.models.slot import Slot
from app.models.book import Book
from app.models.subscription import Subscription
from app.models.business_day import BusinessDay
from app.models.employee_shift import EmployeeShift
from app.models.shift_books import ShiftBooks
from app.models.shift_extra_sales import ShiftExtraSales
from app.models.book_assignment_history import BookAssignmentHistory
from app.models.audit_log import AuditLog
from app.models.store_settings import StoreSettings


# ── App & DB setup ────────────────────────────────────────────────────────────

@pytest.fixture(scope='session')
def app():
    """Single Flask app for the entire test session, using in-memory SQLite."""
    _app = create_app('testing')
    # Disable rate limiting so login tests don't trip the 5/min cap
    _app.config['RATELIMIT_ENABLED'] = False

    ctx = _app.app_context()
    ctx.push()
    _db.create_all()

    yield _app

    _db.drop_all()
    ctx.pop()


@pytest.fixture(scope='function')
def client(app):
    """Fresh test client for each test."""
    with app.test_client() as c:
        yield c


# ── Store / user fixtures ─────────────────────────────────────────────────────

@pytest.fixture(scope='function')
def setup_store():
    """Create a complete store with admin + employee users and an active subscription."""
    store = Store(
        store_name='Test Store',
        store_code='TEST01',
        scan_mode='camera_single',
    )
    _db.session.add(store)
    _db.session.flush()

    sub = Subscription(
        store_id=store.store_id,
        plan='basic',
        status='active',
    )
    _db.session.add(sub)

    admin_hash = bcrypt.hashpw(b'admin1234', bcrypt.gensalt()).decode()
    admin = User(
        username='admin',
        password_hash=admin_hash,
        role='admin',
        store_id=store.store_id,
    )
    _db.session.add(admin)

    emp_hash = bcrypt.hashpw(b'emp1234', bcrypt.gensalt()).decode()
    employee = User(
        username='employee',
        password_hash=emp_hash,
        role='employee',
        store_id=store.store_id,
    )
    _db.session.add(employee)
    _db.session.commit()

    yield {
        'store': store,
        'admin': admin,
        'employee': employee,
    }

    # Full teardown — delete in safe order for FK constraints
    _db.session.query(AuditLog).filter_by(store_id=store.store_id).delete()
    _db.session.query(ShiftBooks).filter(ShiftBooks.store_id == store.store_id).delete()
    _db.session.query(ShiftExtraSales).filter(ShiftExtraSales.store_id == store.store_id).delete()
    _db.session.query(EmployeeShift).filter(EmployeeShift.store_id == store.store_id).delete()
    _db.session.query(BusinessDay).filter(BusinessDay.store_id == store.store_id).delete()
    _db.session.query(BookAssignmentHistory).filter(
        BookAssignmentHistory.book_id.in_(
            _db.session.query(Book.book_id).filter(Book.store_id == store.store_id)
        )
    ).delete(synchronize_session=False)
    _db.session.query(Book).filter(Book.store_id == store.store_id).delete()
    _db.session.query(Slot).filter(Slot.store_id == store.store_id).delete()
    _db.session.query(StoreSettings).filter_by(store_id=store.store_id).delete()
    _db.session.query(User).filter_by(store_id=store.store_id).delete()
    _db.session.query(Subscription).filter_by(store_id=store.store_id).delete()
    _db.session.query(Store).filter_by(store_id=store.store_id).delete()
    _db.session.commit()


@pytest.fixture(scope='function')
def admin_token(client, setup_store):
    """JWT token for the admin user."""
    res = client.post('/api/auth/login', json={
        'store_code': 'TEST01',
        'username': 'admin',
        'password': 'admin1234',
    })
    assert res.status_code == 200, f"admin login failed: {res.json}"
    return res.json['token']


@pytest.fixture(scope='function')
def employee_token(client, setup_store):
    """JWT token for the employee user."""
    res = client.post('/api/auth/login', json={
        'store_code': 'TEST01',
        'username': 'employee',
        'password': 'emp1234',
    })
    assert res.status_code == 200, f"employee login failed: {res.json}"
    return res.json['token']


# ── Slot & book fixture ───────────────────────────────────────────────────────

@pytest.fixture(scope='function')
def setup_slot_and_book(setup_store):
    """
    Add one $5.00 slot and one active book (static_code='1234567890', 60 tickets,
    valid positions 0–59) to the test store.
    """
    store_id = setup_store['store'].store_id

    slot = Slot(
        store_id=store_id,
        slot_name='Slot A',
        ticket_price='5.00',
    )
    _db.session.add(slot)
    _db.session.flush()

    # barcode = static_code + position-padded-3-digits
    # We store position 0 as the starting position.
    book = Book(
        store_id=store_id,
        barcode='1234567890000',   # static_code='1234567890', position=0
        static_code='1234567890',
        ticket_price='5.00',
        slot_id=slot.slot_id,
        is_active=True,
        is_sold=False,
        start_position=0,
    )
    _db.session.add(book)
    _db.session.commit()

    yield {'slot': slot, 'book': book}

    _db.session.query(BookAssignmentHistory).filter(
        BookAssignmentHistory.book_id == book.book_id
    ).delete()
    _db.session.query(Book).filter(Book.store_id == store_id).delete()
    _db.session.query(Slot).filter(Slot.store_id == store_id).delete()
    _db.session.commit()


# ── Scan / shift helpers ──────────────────────────────────────────────────────

def auth_headers(token):
    return {'Authorization': f'Bearer {token}'}


def open_shift(client, token):
    """Open a shift and return the shift dict."""
    res = client.post('/api/shifts', headers=auth_headers(token))
    assert res.status_code == 201, f"open_shift failed: {res.json}"
    return res.json['employee_shift']


def do_scan(client, token, shift_id, barcode, scan_type):
    """Post a scan and return the full response."""
    return client.post('/api/scan', json={
        'shift_id': shift_id,
        'barcode': barcode,
        'scan_type': scan_type,
    }, headers=auth_headers(token))
