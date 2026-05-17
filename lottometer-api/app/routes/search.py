"""Global superadmin search endpoint.

Score formula:
  base score: exact=100, prefix=80, like=60
  type bonus:  store=20, user=10, complaint=5, submission=3, shift=2, business_day=1

Type bonuses and base scores are module-level constants — tune them here.
"""
import time
from datetime import date as _date, datetime, timezone

from flask import Blueprint, request, jsonify
from sqlalchemy import func, or_

from app.auth_helpers import superadmin_required
from app.extensions import db
from app.models.business_day import BusinessDay
from app.models.complaint import Complaint
from app.models.contact_submission import ContactSubmission
from app.models.employee_shift import EmployeeShift
from app.models.store import Store
from app.models.subscription import Subscription
from app.models.user import User

search_bp = Blueprint("search", __name__, url_prefix="/api/superadmin")

# ── Score weights (tune here) ──────────────────────────────────────────────────
_EXACT  = 100
_PREFIX = 80
_LIKE   = 60

_TYPE_BONUS = {
    "store":        20,
    "user":         10,
    "complaint":    5,
    "submission":   3,
    "shift":        2,
    "business_day": 1,
}

_PER_TYPE_LIMIT = 15   # max rows fetched per entity type before trimming
_DEFAULT_LIMIT  = 10
_MAX_LIMIT      = 20


def _score(match_type: str, entity_type: str) -> int:
    base = {"exact": _EXACT, "prefix": _PREFIX}.get(match_type, _LIKE)
    return base + _TYPE_BONUS.get(entity_type, 0)


def _rel_time(dt) -> str:
    """Return a human-readable relative timestamp (e.g. '3h ago')."""
    if dt is None:
        return ""
    delta = (datetime.now(timezone.utc).replace(tzinfo=None) - dt).total_seconds()
    if delta < 60:
        return "just now"
    if delta < 3600:
        return f"{int(delta // 60)}m ago"
    if delta < 86400:
        return f"{int(delta // 3600)}h ago"
    return f"{int(delta // 86400)}d ago"


def _parse_date(s: str):
    """Try to parse s as a date; return a date object or None."""
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


@search_bp.route("/search", methods=["GET"])
@superadmin_required
def global_search():
    t0 = time.monotonic()
    q = (request.args.get("q") or "").strip()
    limit = min(int(request.args.get("limit", _DEFAULT_LIMIT)), _MAX_LIMIT)

    if len(q) < 2:
        return jsonify({"results": [], "total": 0, "took_ms": 0})

    q_upper  = q.upper()
    q_like   = f"%{q}%"
    is_num   = q.isdigit()
    parsed_date = _parse_date(q) if len(q) >= 6 else None

    results: list[dict] = []

    # ── Stores ─────────────────────────────────────────────────────────────────
    store_rows = (
        Store.query.filter(
            or_(
                Store.store_code.ilike(q_like),
                Store.store_name.ilike(q_like),
                Store.owner_name.ilike(q_like),
                Store.email.ilike(q_like),
            )
        )
        .limit(_PER_TYPE_LIMIT)
        .all()
    )

    if store_rows:
        s_ids = [s.store_id for s in store_rows]

        user_counts = dict(
            db.session.query(User.store_id, func.count())
            .filter(User.store_id.in_(s_ids), User.deleted_at.is_(None))
            .group_by(User.store_id)
            .all()
        )
        sub_statuses = dict(
            db.session.query(Subscription.store_id, Subscription.status)
            .filter(Subscription.store_id.in_(s_ids))
            .all()
        )

        for s in store_rows:
            code = (s.store_code or "").upper()
            if code == q_upper:
                match = "exact"
            elif code.startswith(q_upper) or (s.store_name or "").lower().startswith(q.lower()):
                match = "prefix"
            else:
                match = "like"

            n_users   = user_counts.get(s.store_id, 0)
            sub_st    = sub_statuses.get(s.store_id, "—")
            status_lbl = "suspended" if s.suspended else ("inactive" if not s.is_active else sub_st)

            results.append({
                "type":     "store",
                "id":       s.store_id,
                "title":    f"{s.store_name} ({s.store_code})",
                "subtitle": f"Owner: {s.owner_name or '—'} · {n_users} users · {status_lbl}",
                "link":     f"/superadmin/stores/{s.store_id}",
                "score":    _score(match, "store"),
            })

    # ── Users ──────────────────────────────────────────────────────────────────
    user_rows = (
        db.session.query(User, Store)
        .join(Store, User.store_id == Store.store_id)
        .filter(
            User.username.ilike(q_like),
            User.deleted_at.is_(None),
            User.role != "superadmin",
        )
        .limit(_PER_TYPE_LIMIT)
        .all()
    )
    for u, st in user_rows:
        results.append({
            "type":     "user",
            "id":       u.user_id,
            "title":    u.username,
            "subtitle": f"{st.store_code} · {u.role}",
            "link":     f"/superadmin/stores/{st.store_id}",
            "score":    _score("like", "user"),
        })

    # ── Complaints ─────────────────────────────────────────────────────────────
    c_filter = [Complaint.subject.ilike(q_like)]
    if is_num:
        c_filter.append(Complaint.id == int(q))

    complaint_rows = (
        db.session.query(Complaint, Store)
        .join(Store, Complaint.store_id == Store.store_id)
        .filter(or_(*c_filter))
        .order_by(Complaint.created_at.desc())
        .limit(_PER_TYPE_LIMIT)
        .all()
    )
    for c, st in complaint_rows:
        match = "exact" if (is_num and c.id == int(q)) else "like"
        results.append({
            "type":     "complaint",
            "id":       c.id,
            "title":    c.subject,
            "subtitle": f"{st.store_code} · {_rel_time(c.created_at)} · {c.status}",
            "link":     "/superadmin/complaints",
            "score":    _score(match, "complaint"),
        })

    # ── Contact submissions ────────────────────────────────────────────────────
    sub_filter = [
        ContactSubmission.full_name.ilike(q_like),
        ContactSubmission.email.ilike(q_like),
        ContactSubmission.business_name.ilike(q_like),
    ]
    if is_num:
        sub_filter.append(ContactSubmission.id == int(q))

    submission_rows = (
        ContactSubmission.query.filter(or_(*sub_filter))
        .order_by(ContactSubmission.created_at.desc())
        .limit(_PER_TYPE_LIMIT)
        .all()
    )
    for s in submission_rows:
        match = "exact" if (is_num and s.id == int(q)) else "like"
        name_part = s.business_name or s.email
        results.append({
            "type":     "submission",
            "id":       s.id,
            "title":    f"{s.full_name} ({name_part})",
            "subtitle": f"{s.email} · {_rel_time(s.created_at)} · {s.status}",
            "link":     "/superadmin/submissions",
            "score":    _score(match, "submission"),
        })

    # ── Employee shifts (numeric only) ─────────────────────────────────────────
    if is_num:
        shift_pair = (
            db.session.query(EmployeeShift, Store)
            .join(Store, EmployeeShift.store_id == Store.store_id)
            .filter(EmployeeShift.id == int(q))
            .first()
        )
        if shift_pair:
            es, st = shift_pair
            results.append({
                "type":     "shift",
                "id":       es.id,
                "title":    f"Shift #{es.id}",
                "subtitle": f"{st.store_code} · shift #{es.shift_number} · {es.status}",
                "link":     f"/superadmin/stores/{st.store_id}",
                "score":    _score("exact", "shift"),
            })

    # ── Business days (date only) ──────────────────────────────────────────────
    if parsed_date:
        bd_rows = (
            db.session.query(BusinessDay, Store)
            .join(Store, BusinessDay.store_id == Store.store_id)
            .filter(BusinessDay.business_date == parsed_date)
            .limit(_PER_TYPE_LIMIT)
            .all()
        )
        for bd, st in bd_rows:
            results.append({
                "type":     "business_day",
                "id":       bd.id,
                "title":    f"{bd.business_date} — {st.store_code}",
                "subtitle": f"{st.store_name} · {bd.status}",
                "link":     f"/superadmin/stores/{st.store_id}",
                "score":    _score("exact", "business_day"),
            })

    # ── Deduplicate, sort by score DESC, trim ─────────────────────────────────
    seen: set = set()
    deduped: list[dict] = []
    for r in sorted(results, key=lambda x: x["score"], reverse=True):
        key = (r["type"], r["id"])
        if key not in seen:
            seen.add(key)
            deduped.append(r)

    took_ms = round((time.monotonic() - t0) * 1000)
    return jsonify({"results": deduped[:limit], "total": len(deduped), "took_ms": took_ms})
