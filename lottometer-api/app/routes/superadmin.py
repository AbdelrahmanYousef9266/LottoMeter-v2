"""Superadmin routes — cross-store management for LottoMeter staff."""

from datetime import datetime, timezone, date

import bcrypt
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.auth_helpers import superadmin_required
from app.extensions import db
from app.errors import NotFoundError, ConflictError, ValidationError
from app.models.store import Store
from app.models.user import User
from app.models.book import Book
from app.models.employee_shift import EmployeeShift
from app.models.business_day import BusinessDay
from app.models.contact_submission import ContactSubmission

superadmin_bp = Blueprint("superadmin", __name__, url_prefix="/api/superadmin")


# ── helpers ────────────────────────────────────────────────────────────────────

def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _serialize_store(store, stats=True):
    d = {
        "store_id": store.store_id,
        "store_name": store.store_name,
        "store_code": store.store_code,
        "suspended": store.suspended,
        "created_at": store.created_at.isoformat(),
    }
    if stats:
        d["user_count"] = User.query.filter_by(store_id=store.store_id, deleted_at=None).count()
        d["book_count"] = Book.query.filter_by(store_id=store.store_id).count()
        d["shift_count"] = EmployeeShift.query.filter_by(store_id=store.store_id).count()
    return d


def _serialize_user(u):
    return {
        "user_id": u.user_id,
        "username": u.username,
        "role": u.role,
        "created_at": u.created_at.isoformat(),
        "deleted_at": u.deleted_at.isoformat() if u.deleted_at else None,
    }


def _serialize_submission(s):
    return {
        "id": s.id,
        "submission_type": s.submission_type,
        "full_name": s.full_name,
        "business_name": s.business_name,
        "email": s.email,
        "phone": s.phone,
        "city": s.city,
        "num_employees": s.num_employees,
        "how_heard": s.how_heard,
        "message": s.message,
        "state": s.state,
        "store_count": s.store_count,
        "current_process": s.current_process,
        "status": s.status,
        "notes": s.notes,
        "reviewed_at": s.reviewed_at.isoformat() if s.reviewed_at else None,
        "created_at": s.created_at.isoformat(),
    }


# ── stats ──────────────────────────────────────────────────────────────────────

@superadmin_bp.get("/stats")
@jwt_required()
@superadmin_required
def stats():
    today = date.today()
    today_bd_ids = [
        bd.id for bd in BusinessDay.query.filter_by(business_date=today).all()
    ]
    shifts_today = (
        EmployeeShift.query.filter(
            EmployeeShift.business_day_id.in_(today_bd_ids)
        ).count()
        if today_bd_ids else 0
    )
    return jsonify({
        "total_stores": Store.query.count(),
        "active_stores": Store.query.filter_by(suspended=False).count(),
        "total_users": User.query.filter_by(deleted_at=None).count(),
        "new_submissions": ContactSubmission.query.filter_by(status="new").count(),
        "shifts_today": shifts_today,
    }), 200


# ── stores ─────────────────────────────────────────────────────────────────────

@superadmin_bp.get("/stores")
@jwt_required()
@superadmin_required
def list_stores():
    q = request.args.get("q", "").strip().lower()
    stores = Store.query.order_by(Store.created_at.desc()).all()
    if q:
        stores = [s for s in stores if q in s.store_name.lower() or q in s.store_code.lower()]
    return jsonify({"stores": [_serialize_store(s) for s in stores]}), 200


@superadmin_bp.get("/stores/<int:store_id>")
@jwt_required()
@superadmin_required
def get_store(store_id):
    store = Store.query.get(store_id)
    if not store:
        raise NotFoundError("Store not found.")
    users = User.query.filter_by(store_id=store_id).order_by(User.created_at.asc()).all()
    data = _serialize_store(store, stats=True)
    data["users"] = [_serialize_user(u) for u in users]
    return jsonify({"store": data}), 200


@superadmin_bp.post("/stores")
@jwt_required()
@superadmin_required
def create_store():
    body = request.get_json(silent=True) or {}
    store_name = (body.get("store_name") or "").strip()
    store_code = (body.get("store_code") or "").strip().upper()
    admin_username = (body.get("admin_username") or "").strip()
    admin_password = (body.get("admin_password") or "").strip()

    if not all([store_name, store_code, admin_username, admin_password]):
        raise ValidationError("store_name, store_code, admin_username, and admin_password are required.")

    if Store.query.filter_by(store_code=store_code).first():
        raise ConflictError(f"Store code '{store_code}' is already in use.")

    store = Store(store_name=store_name, store_code=store_code)
    db.session.add(store)
    db.session.flush()

    admin = User(
        username=admin_username,
        password_hash=_hash_password(admin_password),
        role="admin",
        store_id=store.store_id,
    )
    db.session.add(admin)

    from app.services.subscription_service import create_trial_subscription
    create_trial_subscription(store.store_id)

    db.session.commit()

    return jsonify({"store": _serialize_store(store), "admin": _serialize_user(admin)}), 201


@superadmin_bp.put("/stores/<int:store_id>")
@jwt_required()
@superadmin_required
def update_store(store_id):
    store = Store.query.get(store_id)
    if not store:
        raise NotFoundError("Store not found.")
    body = request.get_json(silent=True) or {}
    if "store_name" in body and body["store_name"].strip():
        store.store_name = body["store_name"].strip()
    if "store_code" in body and body["store_code"].strip():
        new_code = body["store_code"].strip().upper()
        existing = Store.query.filter_by(store_code=new_code).first()
        if existing and existing.store_id != store_id:
            raise ConflictError(f"Store code '{new_code}' is already in use.")
        store.store_code = new_code
    db.session.commit()
    return jsonify({"store": _serialize_store(store)}), 200


@superadmin_bp.post("/stores/<int:store_id>/suspend")
@jwt_required()
@superadmin_required
def suspend_store(store_id):
    store = Store.query.get(store_id)
    if not store:
        raise NotFoundError("Store not found.")
    store.suspended = True
    db.session.commit()
    return jsonify({"store": _serialize_store(store)}), 200


@superadmin_bp.post("/stores/<int:store_id>/activate")
@jwt_required()
@superadmin_required
def activate_store(store_id):
    store = Store.query.get(store_id)
    if not store:
        raise NotFoundError("Store not found.")
    store.suspended = False
    db.session.commit()
    return jsonify({"store": _serialize_store(store)}), 200


# ── submissions ────────────────────────────────────────────────────────────────

@superadmin_bp.get("/submissions")
@jwt_required()
@superadmin_required
def list_submissions():
    sub_type = request.args.get("type")   # contact | apply
    status = request.args.get("status")   # new | reviewed | approved
    q = ContactSubmission.query.order_by(ContactSubmission.created_at.desc())
    if sub_type:
        q = q.filter_by(submission_type=sub_type)
    if status:
        q = q.filter_by(status=status)
    return jsonify({"submissions": [_serialize_submission(s) for s in q.all()]}), 200


@superadmin_bp.put("/submissions/<int:sub_id>")
@jwt_required()
@superadmin_required
def update_submission(sub_id):
    sub = ContactSubmission.query.get(sub_id)
    if not sub:
        raise NotFoundError("Submission not found.")
    body = request.get_json(silent=True) or {}
    if "notes" in body:
        sub.notes = (body["notes"] or "").strip() or None
    if body.get("mark_reviewed") and sub.status == "new":
        sub.status = "reviewed"
        sub.reviewed_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify({"submission": _serialize_submission(sub)}), 200


@superadmin_bp.post("/submissions/<int:sub_id>/approve")
@jwt_required()
@superadmin_required
def approve_submission(sub_id):
    sub = ContactSubmission.query.get(sub_id)
    if not sub:
        raise NotFoundError("Submission not found.")

    body = request.get_json(silent=True) or {}
    store_code = (body.get("store_code") or "").strip().upper()
    admin_username = (body.get("admin_username") or "").strip()
    admin_password = (body.get("admin_password") or "").strip()
    store_name = (body.get("store_name") or sub.business_name or "").strip()

    if not all([store_code, admin_username, admin_password, store_name]):
        raise ValidationError("store_name, store_code, admin_username, and admin_password are required.")

    if Store.query.filter_by(store_code=store_code).first():
        raise ConflictError(f"Store code '{store_code}' is already in use.")

    store = Store(store_name=store_name, store_code=store_code)
    db.session.add(store)
    db.session.flush()

    admin = User(
        username=admin_username,
        password_hash=_hash_password(admin_password),
        role="admin",
        store_id=store.store_id,
    )
    db.session.add(admin)

    sub.status = "approved"
    sub.reviewed_at = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify({
        "store": _serialize_store(store),
        "admin": _serialize_user(admin),
        "submission": _serialize_submission(sub),
    }), 201
