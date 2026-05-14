"""Complaint routes — store owners submit, superadmin manages."""

from datetime import datetime, timezone

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from app.auth_helpers import admin_required, superadmin_required, current_store_id, current_user_id
from app.extensions import db
from app.errors import NotFoundError, ValidationError
from app.models.complaint import Complaint
from app.models.store import Store
from app.services.audit_service import log_action

complaints_bp = Blueprint("complaints", __name__, url_prefix="/api")


# ── helpers ────────────────────────────────────────────────────────────────────

def _serialize(c, include_store=False):
    d = {
        "id":          c.id,
        "store_id":    c.store_id,
        "subject":     c.subject,
        "message":     c.message,
        "status":      c.status,
        "priority":    c.priority,
        "staff_reply": c.staff_reply,
        "created_at":  c.created_at.isoformat(),
        "updated_at":  c.updated_at.isoformat(),
    }
    if include_store and c.store:
        d["store_name"] = c.store.store_name
        d["store_code"] = c.store.store_code
    return d


# ── Store owner: submit a complaint ───────────────────────────────────────────

@complaints_bp.post("/complaints")
@admin_required
def submit_complaint():
    body = request.get_json(silent=True) or {}
    subject = (body.get("subject") or "").strip()
    message = (body.get("message") or "").strip()

    if not subject:
        raise ValidationError("'subject' is required.")
    if not message:
        raise ValidationError("'message' is required.")
    if len(subject) > 255:
        raise ValidationError("'subject' must be 255 characters or fewer.")

    store_id = current_store_id()
    complaint = Complaint(
        store_id=store_id,
        subject=subject,
        message=message,
        status="open",
        priority="medium",
    )
    db.session.add(complaint)
    db.session.commit()

    log_action(
        "complaint_submitted",
        user_id=current_user_id(),
        store_id=store_id,
        entity_type="complaint",
        entity_id=complaint.id,
        new_value=subject,
        ip_address=request.remote_addr,
        user_agent=(request.headers.get("User-Agent") or "")[:200],
    )

    return jsonify({"complaint": _serialize(complaint)}), 201


# ── Superadmin: list all complaints ───────────────────────────────────────────

@complaints_bp.get("/superadmin/complaints")
@jwt_required()
@superadmin_required
def list_complaints():
    status_filter = request.args.get("status", "all").lower()

    query = Complaint.query.order_by(Complaint.created_at.desc())
    if status_filter in ("open", "resolved"):
        query = query.filter_by(status=status_filter)

    complaints = query.all()
    return jsonify({
        "complaints": [_serialize(c, include_store=True) for c in complaints]
    }), 200


# ── Superadmin: complaint stats ────────────────────────────────────────────────

@complaints_bp.get("/superadmin/complaints/stats")
@jwt_required()
@superadmin_required
def complaint_stats():
    total    = Complaint.query.count()
    open_ct  = Complaint.query.filter_by(status="open").count()
    resolved = Complaint.query.filter_by(status="resolved").count()
    return jsonify({"open": open_ct, "resolved": resolved, "total": total}), 200


# ── Superadmin: update a complaint ────────────────────────────────────────────

@complaints_bp.patch("/superadmin/complaints/<int:complaint_id>")
@jwt_required()
@superadmin_required
def update_complaint(complaint_id):
    complaint = Complaint.query.get(complaint_id)
    if not complaint:
        raise NotFoundError("Complaint not found.", code="COMPLAINT_NOT_FOUND")

    body = request.get_json(silent=True) or {}
    new_status = (body.get("status") or "").strip().lower()
    reply      = (body.get("reply") or "").strip() or None

    if new_status and new_status not in ("open", "resolved"):
        raise ValidationError("'status' must be 'open' or 'resolved'.")

    if new_status:
        complaint.status = new_status
    if reply is not None:
        complaint.staff_reply = reply
    complaint.updated_at = datetime.now(timezone.utc)

    db.session.commit()

    log_action(
        "complaint_updated",
        user_id=current_user_id(),
        store_id=complaint.store_id,
        entity_type="complaint",
        entity_id=complaint.id,
        new_value=new_status or "reply_added",
        ip_address=request.remote_addr,
        user_agent=(request.headers.get("User-Agent") or "")[:200],
    )

    return jsonify({"complaint": _serialize(complaint, include_store=True)}), 200
