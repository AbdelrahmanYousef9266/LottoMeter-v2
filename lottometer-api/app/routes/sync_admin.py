"""Superadmin sync control — visibility and remediation for mobile sync health."""

from datetime import datetime, timezone, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func, case

from app.auth_helpers import superadmin_required
from app.extensions import db
from app.errors import NotFoundError
from app.models.sync_event import SyncEvent
from app.models.store import Store


def _iso(val):
    """Safely serialise a datetime that may come back as a string from SQLite aggregates."""
    if val is None:
        return None
    if isinstance(val, str):
        return val.replace(" ", "T") + "Z"
    return val.isoformat() + "Z"


sync_admin_bp = Blueprint("sync_admin", __name__, url_prefix="/api/superadmin/sync")


@sync_admin_bp.get("/overview")
@jwt_required()
@superadmin_required
def overview():
    """Per-store sync stats for the last 7 days, plus force_full_resync flags."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    rows = (
        db.session.query(
            SyncEvent.store_id,
            Store.store_code,
            Store.store_name,
            Store.force_full_resync,
            func.count(SyncEvent.id).label("total"),
            func.count(
                case((SyncEvent.status == "error", SyncEvent.id), else_=None)
            ).label("errors"),
            func.max(SyncEvent.created_at).label("last_event_at"),
        )
        .join(Store, Store.store_id == SyncEvent.store_id)
        .filter(SyncEvent.created_at >= cutoff)
        .group_by(
            SyncEvent.store_id,
            Store.store_code,
            Store.store_name,
            Store.force_full_resync,
        )
        .all()
    )

    return jsonify({
        "stores": [
            {
                "store_id":          r.store_id,
                "store_code":        r.store_code,
                "store_name":        r.store_name,
                "force_full_resync": r.force_full_resync,
                "total_events":      r.total,
                "error_events":      r.errors or 0,
                "last_event_at":     _iso(r.last_event_at),
            }
            for r in rows
        ]
    }), 200


@sync_admin_bp.get("/store/<int:store_id>/log")
@jwt_required()
@superadmin_required
def store_log(store_id):
    """Paginated sync event log for one store, newest first."""
    store = Store.query.get(store_id)
    if store is None:
        raise NotFoundError("Store not found.", code="STORE_NOT_FOUND")

    page     = max(int(request.args.get("page", 1)), 1)
    per_page = min(int(request.args.get("per_page", 50)), 200)

    q     = SyncEvent.query.filter_by(store_id=store_id).order_by(SyncEvent.created_at.desc())
    total = q.count()
    events = q.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        "store_id": store_id,
        "total":    total,
        "page":     page,
        "per_page": per_page,
        "events":   [e.to_dict() for e in events],
    }), 200


@sync_admin_bp.get("/failures")
@jwt_required()
@superadmin_required
def failures():
    """All non-discarded error events across all stores, newest first."""
    rows = (
        db.session.query(SyncEvent, Store.store_code, Store.store_name)
        .join(Store, Store.store_id == SyncEvent.store_id)
        .filter(SyncEvent.status == "error", SyncEvent.discarded == False)
        .order_by(SyncEvent.created_at.desc())
        .limit(500)
        .all()
    )

    return jsonify({
        "failures": [
            {
                **r.SyncEvent.to_dict(),
                "store_code": r.store_code,
                "store_name": r.store_name,
            }
            for r in rows
        ]
    }), 200


@sync_admin_bp.post("/store/<int:store_id>/force-resync")
@jwt_required()
@superadmin_required
def force_resync(store_id):
    """Flag this store for a full mobile resync on next sync run."""
    store = Store.query.get(store_id)
    if store is None:
        raise NotFoundError("Store not found.", code="STORE_NOT_FOUND")

    store.force_full_resync = True
    db.session.commit()
    return jsonify({"store_id": store_id, "force_full_resync": True}), 200


@sync_admin_bp.delete("/events/<int:event_id>/discard")
@jwt_required()
@superadmin_required
def discard_event(event_id):
    """Mark a failed sync event as discarded so it no longer appears in failures."""
    event = SyncEvent.query.get(event_id)
    if event is None:
        raise NotFoundError("Sync event not found.", code="SYNC_EVENT_NOT_FOUND")

    event.discarded = True
    db.session.commit()
    return jsonify({"id": event_id, "discarded": True}), 200
