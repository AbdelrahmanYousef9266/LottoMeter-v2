"""Superadmin routes — cross-store management for LottoMeter staff."""

from datetime import datetime, timezone, date, timedelta

import bcrypt
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app.auth_helpers import superadmin_required, current_user_id
from app.extensions import db
from app.errors import NotFoundError, ConflictError, ValidationError
from app.models.store import Store
from app.models.user import User
from app.models.book import Book
from app.models.employee_shift import EmployeeShift
from app.models.business_day import BusinessDay
from app.models.contact_submission import ContactSubmission
from app.services.audit_service import log_action

superadmin_bp = Blueprint("superadmin", __name__, url_prefix="/api/superadmin")


# ── helpers ────────────────────────────────────────────────────────────────────

def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _serialize_store(store, stats=True):
    d = {
        "store_id":   store.store_id,
        "store_name": store.store_name,
        "store_code": store.store_code,
        "suspended":  store.suspended,
        "is_active":  store.is_active,
        "owner_name": store.owner_name,
        "email":      store.email,
        "phone":      store.phone,
        "address":    store.address,
        "city":       store.city,
        "state":      store.state,
        "zip_code":   store.zip_code,
        "created_by": store.created_by,
        "notes":      store.notes,
        "created_at": store.created_at.isoformat(),
    }
    if stats:
        d["user_count"]  = User.query.filter_by(store_id=store.store_id, deleted_at=None).count()
        d["book_count"]  = Book.query.filter_by(store_id=store.store_id).count()
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
    store_name     = (body.get("store_name") or "").strip()
    store_code     = (body.get("store_code") or "").strip().upper()
    admin_username = (body.get("admin_username") or "").strip()
    admin_password = (body.get("admin_password") or "").strip()

    if not all([store_name, store_code, admin_username, admin_password]):
        raise ValidationError("store_name, store_code, admin_username, and admin_password are required.")

    if Store.query.filter_by(store_code=store_code).first():
        raise ConflictError(f"Store code '{store_code}' is already in use.")

    actor_id = current_user_id()
    store = Store(
        store_name=store_name,
        store_code=store_code,
        owner_name=(body.get("owner_name") or "").strip() or None,
        email=(body.get("email") or "").strip() or None,
        phone=(body.get("phone") or "").strip() or None,
        address=(body.get("address") or "").strip() or None,
        city=(body.get("city") or "").strip() or None,
        state=(body.get("state") or "").strip() or None,
        zip_code=(body.get("zip_code") or "").strip() or None,
        notes=(body.get("notes") or "").strip() or None,
        created_by=actor_id,
    )
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

    from app.services.store_settings_service import create_default_settings
    create_default_settings(store.store_id)

    db.session.commit()

    log_action("store_created", user_id=actor_id, store_id=store.store_id,
               entity_type="store", entity_id=store.store_id,
               new_value=f"store_code={store.store_code} admin={admin_username}",
               ip_address=request.remote_addr,
               user_agent=(request.headers.get("User-Agent") or "")[:200])

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
    if "notes" in body:
        store.notes = (body["notes"] or "").strip() or None
    if "is_active" in body and isinstance(body["is_active"], bool):
        store.is_active = body["is_active"]
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
    log_action("store_suspended", user_id=current_user_id(), store_id=store_id,
               entity_type="store", entity_id=store_id,
               ip_address=request.remote_addr,
               user_agent=(request.headers.get("User-Agent") or "")[:200])
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

    store = Store(
        store_name=store_name,
        store_code=store_code,
        owner_name=(body.get("owner_name") or "").strip() or None,
        email=(body.get("email") or "").strip() or None,
        phone=(body.get("phone") or "").strip() or None,
        city=(body.get("city") or "").strip() or None,
        state=(body.get("state") or "").strip() or None,
    )
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

    from app.services.store_settings_service import create_default_settings
    create_default_settings(store.store_id)

    sub.status = "approved"
    sub.reviewed_at = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify({
        "store": _serialize_store(store),
        "admin": _serialize_user(admin),
        "submission": _serialize_submission(sub),
    }), 201


# ── audit logs ────────────────────────────────────────────────────────────────

@superadmin_bp.get("/audit-logs")
@jwt_required()
@superadmin_required
def list_audit_logs():
    from app.models.audit_log import AuditLog

    store_id_filter = request.args.get("store_id", type=int)
    action_filter   = request.args.get("action", "").strip() or None
    date_from       = request.args.get("date_from", "").strip() or None
    date_to         = request.args.get("date_to", "").strip() or None

    q = AuditLog.query.order_by(AuditLog.created_at.desc())

    if store_id_filter:
        q = q.filter_by(store_id=store_id_filter)
    if action_filter:
        q = q.filter_by(action=action_filter)
    if date_from:
        try:
            from datetime import datetime
            q = q.filter(AuditLog.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            from datetime import datetime
            q = q.filter(AuditLog.created_at <= datetime.fromisoformat(date_to))
        except ValueError:
            pass

    logs = q.limit(500).all()
    return jsonify({
        "audit_logs": [
            {
                "id":          l.id,
                "user_id":     l.user_id,
                "store_id":    l.store_id,
                "action":      l.action,
                "entity_type": l.entity_type,
                "entity_id":   l.entity_id,
                "old_value":   l.old_value,
                "new_value":   l.new_value,
                "ip_address":  l.ip_address,
                "user_agent":  l.user_agent,
                "created_at":  l.created_at.isoformat(),
            }
            for l in logs
        ]
    }), 200


# ── subscriptions ──────────────────────────────────────────────────────────────

def _serialize_subscription(sub, store=None):
    d = {
        "id":                    sub.id,
        "store_id":              sub.store_id,
        "plan":                  sub.plan,
        "status":                sub.status,
        "plan_price":            float(sub.plan_price) if sub.plan_price is not None else None,
        "billing_email":         sub.billing_email,
        "card_last4":            sub.card_last4,
        "card_brand":            sub.card_brand,
        "cancel_at_period_end":  sub.cancel_at_period_end,
        "cancelled_reason":      sub.cancelled_reason,
        "notes":                 sub.notes,
        "trial_ends_at":         sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
        "current_period_start":  sub.current_period_start.isoformat() if sub.current_period_start else None,
        "current_period_end":    sub.current_period_end.isoformat() if sub.current_period_end else None,
        "stripe_customer_id":    sub.stripe_customer_id,
        "stripe_subscription_id": sub.stripe_subscription_id,
        "cancelled_at":          sub.cancelled_at.isoformat() if sub.cancelled_at else None,
        "created_at":            sub.created_at.isoformat(),
    }
    if store:
        d["store_name"] = store.store_name
        d["store_code"] = store.store_code
    return d


@superadmin_bp.get("/subscriptions")
@jwt_required()
@superadmin_required
def list_subscriptions():
    from app.services.subscription_service import get_all_subscriptions
    include_cancelled = request.args.get("include_cancelled", "false").lower() == "true"
    rows = get_all_subscriptions(include_cancelled=include_cancelled)
    return jsonify({
        "subscriptions": [_serialize_subscription(sub, store) for sub, store in rows]
    }), 200


@superadmin_bp.post("/stores/<int:store_id>/cancel-subscription")
@jwt_required()
@superadmin_required
def cancel_store_subscription(store_id):
    store = Store.query.get(store_id)
    if not store:
        raise NotFoundError("Store not found.")
    body = request.get_json(silent=True) or {}
    reason = (body.get("reason") or "").strip() or None
    from app.services.subscription_service import cancel_subscription
    sub = cancel_subscription(store_id, reason=reason)
    if not sub:
        raise NotFoundError("No subscription found for this store.")
    log_action("subscription_cancelled", user_id=current_user_id(), store_id=store_id,
               entity_type="subscription", entity_id=sub.id,
               new_value=reason,
               ip_address=request.remote_addr,
               user_agent=(request.headers.get("User-Agent") or "")[:200])
    return jsonify({"subscription": _serialize_subscription(sub)}), 200


@superadmin_bp.post("/stores/<int:store_id>/reactivate-subscription")
@jwt_required()
@superadmin_required
def reactivate_store_subscription(store_id):
    store = Store.query.get(store_id)
    if not store:
        raise NotFoundError("Store not found.")
    from app.services.subscription_service import reactivate_subscription
    sub = reactivate_subscription(store_id)
    if not sub:
        raise NotFoundError("No subscription found for this store.")
    log_action("subscription_reactivated", user_id=current_user_id(), store_id=store_id,
               entity_type="subscription", entity_id=sub.id,
               ip_address=request.remote_addr,
               user_agent=(request.headers.get("User-Agent") or "")[:200])
    return jsonify({"subscription": _serialize_subscription(sub)}), 200


@superadmin_bp.post("/stores/<int:store_id>/extend-trial")
@jwt_required()
@superadmin_required
def extend_store_trial(store_id):
    store = Store.query.get(store_id)
    if not store:
        raise NotFoundError("Store not found.")
    body = request.get_json(silent=True) or {}
    days = body.get("days")
    if not isinstance(days, int) or days < 1:
        raise ValidationError("'days' must be a positive integer.")
    from app.services.subscription_service import extend_trial
    sub = extend_trial(store_id, days=days)
    if not sub:
        raise NotFoundError("No subscription found for this store.")
    log_action("trial_extended", user_id=current_user_id(), store_id=store_id,
               entity_type="subscription", entity_id=sub.id,
               new_value=f"days={days}",
               ip_address=request.remote_addr,
               user_agent=(request.headers.get("User-Agent") or "")[:200])
    return jsonify({"subscription": _serialize_subscription(sub)}), 200


# ── per-store health ───────────────────────────────────────────────────────────

@superadmin_bp.get("/stores/<int:store_id>/health")
@jwt_required()
@superadmin_required
def get_store_health(store_id):
    from app.models.subscription import Subscription
    from app.models.audit_log import AuditLog
    from app.models.complaint import Complaint
    from app.models.sync_event import SyncEvent

    store = Store.query.get(store_id)
    if not store:
        raise NotFoundError("Store not found.")

    def _iso_dt(dt):
        if dt is None:
            return None
        if isinstance(dt, str):
            return dt.replace(" ", "T") + "Z"
        if dt.tzinfo is None:
            return dt.isoformat() + "Z"
        return dt.isoformat()

    # ── store ──────────────────────────────────────────────────────────────
    store_data = _serialize_store(store, stats=True)
    store_data["store_pin_set"] = bool(getattr(store, "store_pin_hash", None))
    store_users = User.query.filter_by(store_id=store_id).order_by(User.created_at.asc()).all()
    store_data["users"] = [_serialize_user(u) for u in store_users]

    # ── subscription ───────────────────────────────────────────────────────
    sub = (
        Subscription.query
        .filter_by(store_id=store_id)
        .order_by(Subscription.created_at.desc())
        .first()
    )
    subscription_data = _serialize_subscription(sub) if sub else None

    # ── sync health ────────────────────────────────────────────────────────
    last_event = (
        SyncEvent.query
        .filter_by(store_id=store_id)
        .order_by(SyncEvent.created_at.desc())
        .first()
    )
    failed_count = SyncEvent.query.filter_by(store_id=store_id, status="failed").count()

    if last_event is None:
        sync_status = "no_data"
        last_event_ts = None
    elif failed_count > 0:
        sync_status = "errors"
        last_event_ts = last_event.created_at
    else:
        ts = last_event.created_at
        if isinstance(ts, str):
            from datetime import datetime as _dt
            ts = _dt.fromisoformat(ts.replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        age_minutes = (datetime.now(timezone.utc) - ts).total_seconds() / 60
        sync_status = "ok" if age_minutes < 60 else "stale"
        last_event_ts = last_event.created_at

    sync_health = {
        "status": sync_status,
        "failed_count": failed_count,
        "last_event_at": _iso_dt(last_event_ts),
    }

    # ── complaints ─────────────────────────────────────────────────────────
    complaints_open = Complaint.query.filter_by(store_id=store_id, status="open").count()

    # ── shifts ─────────────────────────────────────────────────────────────
    recent_shifts_q = (
        EmployeeShift.query
        .filter_by(store_id=store_id)
        .order_by(EmployeeShift.opened_at.desc())
        .limit(10)
        .all()
    )
    trend_q = (
        EmployeeShift.query
        .filter_by(store_id=store_id)
        .filter(EmployeeShift.status == "closed", EmployeeShift.voided == False)  # noqa: E712
        .order_by(EmployeeShift.opened_at.desc())
        .limit(30)
        .all()
    )
    active_shift = EmployeeShift.query.filter_by(store_id=store_id, status="open").first()

    all_emp_ids = list({
        sh.employee_id
        for sh in list(recent_shifts_q) + list(trend_q) + ([active_shift] if active_shift else [])
        if sh.employee_id
    })
    users_map = {}
    if all_emp_ids:
        emp_users = User.query.filter(User.user_id.in_(all_emp_ids)).all()
        users_map = {u.user_id: u.username for u in emp_users}

    def _shift_dict(sh):
        return {
            "id":            sh.id,
            "shift_number":  sh.shift_number,
            "employee_name": users_map.get(sh.employee_id, "—"),
            "opened_at":     _iso_dt(sh.opened_at),
            "closed_at":     _iso_dt(sh.closed_at),
            "status":        sh.status,
            "difference":    float(sh.difference) if sh.difference is not None else None,
            "shift_status":  sh.shift_status,
            "voided":        bool(sh.voided),
        }

    variance_trend = [
        {
            "shift_number": sh.shift_number,
            "difference":   float(sh.difference) if sh.difference is not None else 0,
            "shift_status": sh.shift_status,
            "date":         _iso_dt(sh.closed_at or sh.opened_at),
        }
        for sh in reversed(trend_q)
    ]

    # ── recent audit log ──────────────────────────────────────────────────
    audit_rows = (
        AuditLog.query
        .filter_by(store_id=store_id)
        .order_by(AuditLog.created_at.desc())
        .limit(20)
        .all()
    )

    return jsonify({
        "store":           store_data,
        "subscription":    subscription_data,
        "sync_health":     sync_health,
        "complaints_open": complaints_open,
        "active_shift":    _shift_dict(active_shift) if active_shift else None,
        "recent_shifts":   [_shift_dict(sh) for sh in recent_shifts_q],
        "variance_trend":  variance_trend,
        "recent_audit":    [
            {
                "id":          l.id,
                "user_id":     l.user_id,
                "action":      l.action,
                "entity_type": l.entity_type,
                "entity_id":   l.entity_id,
                "created_at":  _iso_dt(l.created_at),
            }
            for l in audit_rows
        ],
    }), 200


# ── unified activity feed ──────────────────────────────────────────────────────

# Severity thresholds for shift variance (absolute cash difference in dollars)
_VARIANCE_WARN_THRESHOLD = 50
_VARIANCE_CRIT_THRESHOLD = 200

# Audit actions and their fixed severity (everything else is "info")
_AUDIT_SEVERITY = {
    "store_suspended": "critical",
    "store_deleted":   "critical",
    "subscription_cancelled": "warning",
}


def _activity_iso(dt):
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt.replace(" ", "T") + "Z"
    if dt.tzinfo is None:
        return dt.isoformat() + "Z"
    return dt.isoformat()


def _audit_item(row, store_map, users_map):
    s = store_map.get(row.store_id) if row.store_id else None
    code  = s["code"]  if s else None
    sname = s["name"]  if s else None
    actor = users_map.get(row.user_id, "system") if row.user_id else "system"
    action = row.action

    if action == "store_created":
        title    = f"Store {code or sname} created"
        severity = "info"
    elif action == "store_suspended":
        title    = f"Store {code or sname} suspended"
        severity = "critical"
    elif action in ("store_activated", "store_reactivated"):
        title    = f"Store {code or sname} reactivated"
        severity = "info"
    elif action == "subscription_cancelled":
        title    = f"Subscription cancelled for {code or sname}"
        severity = "warning"
    elif action == "subscription_reactivated":
        title    = f"Subscription reactivated for {code or sname}"
        severity = "info"
    elif action == "trial_extended":
        title    = f"Trial extended for {code or sname}"
        severity = "info"
    else:
        title    = action.replace("_", " ").capitalize()
        severity = _AUDIT_SEVERITY.get(action, "info")

    return {
        "id":         f"audit_{row.id}",
        "type":       "store",
        "timestamp":  _activity_iso(row.created_at),
        "title":      title,
        "subtitle":   f"by {actor}",
        "severity":   severity,
        "store_id":   row.store_id,
        "store_code": code,
        "link":       f"/superadmin/stores/{row.store_id}" if row.store_id else None,
    }


@superadmin_bp.get("/activity")
@jwt_required()
@superadmin_required
def get_activity():
    from app.models.audit_log import AuditLog
    from app.models.complaint import Complaint
    from app.models.sync_event import SyncEvent

    limit     = min(int(request.args.get("limit", 50)), 200)
    feed_type = request.args.get("type", "all")
    cutoff    = datetime.now(timezone.utc) - timedelta(days=7)

    # ── shared store lookup (one query) ───────────────────────────────────
    store_rows = Store.query.with_entities(
        Store.store_id, Store.store_code, Store.store_name
    ).all()
    store_map = {r.store_id: {"code": r.store_code, "name": r.store_name} for r in store_rows}

    items = []

    # ── audit log → "store" feed items ────────────────────────────────────
    if feed_type in ("all", "stores"):
        audit_rows = (
            AuditLog.query
            .filter(AuditLog.created_at >= cutoff)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .all()
        )
        actor_ids = list({r.user_id for r in audit_rows if r.user_id})
        users_map = {}
        if actor_ids:
            urows = User.query.filter(User.user_id.in_(actor_ids)).with_entities(
                User.user_id, User.username
            ).all()
            users_map = {u.user_id: u.username for u in urows}

        for row in audit_rows:
            items.append(_audit_item(row, store_map, users_map))

    # ── complaints ────────────────────────────────────────────────────────
    if feed_type in ("all", "complaints"):
        complaint_rows = (
            Complaint.query
            .filter(Complaint.created_at >= cutoff)
            .order_by(Complaint.created_at.desc())
            .limit(limit)
            .all()
        )
        for c in complaint_rows:
            s    = store_map.get(c.store_id) if c.store_id else None
            code = s["code"] if s else None
            items.append({
                "id":         f"complaint_{c.id}",
                "type":       "complaint",
                "timestamp":  _activity_iso(c.created_at),
                "title":      (c.subject or "New complaint")[:80],
                "subtitle":   f"Priority: {c.priority}" if c.priority else "",
                "severity":   "warning" if c.priority == "high" else "info",
                "store_id":   c.store_id,
                "store_code": code,
                "link":       "/superadmin/complaints",
            })

    # ── contact submissions ───────────────────────────────────────────────
    if feed_type in ("all", "submissions"):
        sub_rows = (
            ContactSubmission.query
            .filter(ContactSubmission.created_at >= cutoff)
            .order_by(ContactSubmission.created_at.desc())
            .limit(limit)
            .all()
        )
        for s in sub_rows:
            name = s.business_name or s.full_name or "Unknown"
            items.append({
                "id":         f"submission_{s.id}",
                "type":       "submission",
                "timestamp":  _activity_iso(s.created_at),
                "title":      f"New {s.submission_type} from {name}",
                "subtitle":   s.email or "",
                "severity":   "info",
                "store_id":   None,
                "store_code": None,
                "link":       "/superadmin/submissions",
            })

    # ── sync errors ───────────────────────────────────────────────────────
    if feed_type in ("all", "sync"):
        one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
        high_error_ids = {
            r.store_id
            for r in (
                db.session.query(SyncEvent.store_id, func.count(SyncEvent.id).label("n"))
                .filter(SyncEvent.status == "failed", SyncEvent.created_at >= one_hour_ago)
                .group_by(SyncEvent.store_id)
                .having(func.count(SyncEvent.id) > 10)
                .all()
            )
        }
        sync_rows = (
            SyncEvent.query
            .filter(SyncEvent.status == "failed", SyncEvent.created_at >= cutoff)
            .order_by(SyncEvent.created_at.desc())
            .limit(limit)
            .all()
        )
        for ev in sync_rows:
            s    = store_map.get(ev.store_id) if ev.store_id else None
            code = s["code"] if s else None
            items.append({
                "id":         f"sync_{ev.id}",
                "type":       "sync",
                "timestamp":  _activity_iso(ev.created_at),
                "title":      f"Sync error: {ev.operation}" if ev.operation else "Sync error",
                "subtitle":   f"Store {code}" if code else (f"Store #{ev.store_id}" if ev.store_id else ""),
                "severity":   "critical" if ev.store_id in high_error_ids else "warning",
                "store_id":   ev.store_id,
                "store_code": code,
                "link":       f"/superadmin/stores/{ev.store_id}" if ev.store_id else None,
            })

    # ── notable shift variance ────────────────────────────────────────────
    if feed_type in ("all", "variance"):
        variance_rows = (
            EmployeeShift.query
            .filter(
                EmployeeShift.closed_at >= cutoff,
                EmployeeShift.shift_status.in_(["short", "over"]),
                EmployeeShift.voided == False,  # noqa: E712
                func.abs(EmployeeShift.difference) > _VARIANCE_WARN_THRESHOLD,
            )
            .order_by(EmployeeShift.closed_at.desc())
            .limit(limit)
            .all()
        )
        for sh in variance_rows:
            s    = store_map.get(sh.store_id) if sh.store_id else None
            code = s["code"] if s else None
            diff = float(sh.difference) if sh.difference is not None else 0
            direction = "over" if diff > 0 else "short"
            items.append({
                "id":         f"variance_{sh.id}",
                "type":       "variance",
                "timestamp":  _activity_iso(sh.closed_at),
                "title":      f"Shift #{sh.shift_number} {direction} by ${abs(diff):.2f}",
                "subtitle":   f"Store {code}" if code else "",
                "severity":   "critical" if abs(diff) > _VARIANCE_CRIT_THRESHOLD else "warning",
                "store_id":   sh.store_id,
                "store_code": code,
                "link":       f"/superadmin/stores/{sh.store_id}" if sh.store_id else None,
            })

    # ── merge, sort DESC, trim ─────────────────────────────────────────────
    items.sort(key=lambda x: x["timestamp"] or "", reverse=True)
    return jsonify({"activity": items[:limit], "count": len(items[:limit])}), 200
