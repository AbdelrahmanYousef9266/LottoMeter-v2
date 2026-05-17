"""Fulfillment workflow routes — superadmin only."""
import json

from flask import Blueprint, request, jsonify

from app.extensions import db
from app.auth_helpers import superadmin_required, current_user_id
from app.services.audit_service import log_action
from app.models.fulfillment_order import FulfillmentOrder, VALID_STATES, ALLOWED_TRANSITIONS

fulfillment_bp = Blueprint('fulfillment', __name__, url_prefix='/api/superadmin/fulfillment')

# Active states shown on the Kanban board (all except terminal)
ACTIVE_STATES = [s for s in VALID_STATES if s != 'cancelled']


# ---------------------------------------------------------------------------
# GET /api/superadmin/fulfillment
# Summary counts per state for badge + board header
# ---------------------------------------------------------------------------
@fulfillment_bp.get('')
@superadmin_required
def get_summary():
    rows = (
        db.session.query(FulfillmentOrder.state, db.func.count(FulfillmentOrder.id))
        .group_by(FulfillmentOrder.state)
        .all()
    )
    counts = {state: 0 for state in VALID_STATES}
    for state, cnt in rows:
        counts[state] = cnt

    active_total = sum(counts[s] for s in ACTIVE_STATES)
    return jsonify({'counts': counts, 'active_total': active_total}), 200


# ---------------------------------------------------------------------------
# GET /api/superadmin/fulfillment/all?state=...&limit=50&offset=0&q=...
# List orders, optionally filtered by state and/or search query
# ---------------------------------------------------------------------------
@fulfillment_bp.get('/all')
@superadmin_required
def list_orders():
    state  = request.args.get('state', '').strip()
    q      = request.args.get('q', '').strip()
    limit  = min(int(request.args.get('limit',  50)), 200)
    offset = max(int(request.args.get('offset',  0)), 0)

    query = FulfillmentOrder.query

    if state and state in VALID_STATES:
        query = query.filter(FulfillmentOrder.state == state)

    if q:
        like = f'%{q}%'
        from sqlalchemy import or_
        query = query.filter(or_(
            FulfillmentOrder.full_name.ilike(like),
            FulfillmentOrder.email.ilike(like),
            FulfillmentOrder.business_name.ilike(like),
        ))

    total = query.count()
    orders = query.order_by(FulfillmentOrder.created_at.desc()).offset(offset).limit(limit).all()

    return jsonify({
        'orders': [o.to_dict() for o in orders],
        'total': total,
        'limit': limit,
        'offset': offset,
    }), 200


# ---------------------------------------------------------------------------
# GET /api/superadmin/fulfillment/<id>
# Single order detail with submission snapshot
# ---------------------------------------------------------------------------
@fulfillment_bp.get('/<int:order_id>')
@superadmin_required
def get_order(order_id):
    order = FulfillmentOrder.query.get_or_404(order_id)
    return jsonify(order.to_dict(include_submission=True)), 200


# ---------------------------------------------------------------------------
# PATCH /api/superadmin/fulfillment/<id>
# Update state, operational fields, or notes
# Body: { state?, tracking_number?, payment_link?, device_serial?, notes?,
#         shipping_name?, shipping_address?, shipping_address2?,
#         shipping_city?, shipping_state?, shipping_zip? }
# ---------------------------------------------------------------------------
@fulfillment_bp.patch('/<int:order_id>')
@superadmin_required
def update_order(order_id):
    order = FulfillmentOrder.query.get_or_404(order_id)
    body  = request.get_json(silent=True) or {}
    uid   = current_user_id()

    old_state = order.state

    # --- State transition -------------------------------------------------
    new_state = body.get('state')
    if new_state is not None:
        if new_state not in VALID_STATES:
            return jsonify({'error': f'Unknown state: {new_state}'}), 400
        if new_state != old_state:
            if not order.can_transition_to(new_state):
                allowed = ALLOWED_TRANSITIONS.get(old_state, [])
                return jsonify({
                    'error': f'Cannot transition from {old_state!r} to {new_state!r}.',
                    'allowed': allowed,
                }), 422
            order.apply_transition(new_state)
            log_action(
                action='fulfillment_state_change',
                user_id=uid,
                store_id=None,
                entity_type='fulfillment_order',
                entity_id=order_id,
                old_value=old_state,
                new_value=new_state,
            )

    # --- Operational fields -----------------------------------------------
    _PATCHABLE = [
        'tracking_number', 'payment_link', 'device_serial', 'notes',
        'shipping_name', 'shipping_address', 'shipping_address2',
        'shipping_city', 'shipping_state', 'shipping_zip',
    ]
    for field in _PATCHABLE:
        if field in body:
            setattr(order, field, body[field])

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Server error. Please try again.'}), 500

    return jsonify(order.to_dict(include_submission=True)), 200


# ---------------------------------------------------------------------------
# POST /api/superadmin/fulfillment/<id>/note
# Append a timestamped note (prepend to existing notes text)
# Body: { text: "..." }
# ---------------------------------------------------------------------------
@fulfillment_bp.post('/<int:order_id>/note')
@superadmin_required
def add_note(order_id):
    order = FulfillmentOrder.query.get_or_404(order_id)
    body  = request.get_json(silent=True) or {}
    text  = (body.get('text') or '').strip()

    if not text:
        return jsonify({'error': 'Note text is required.'}), 400
    if len(text) > 2000:
        return jsonify({'error': 'Note must be 2000 characters or fewer.'}), 400

    from datetime import datetime, timezone
    ts      = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    new_note = f'[{ts}] {text}'
    order.notes = f'{new_note}\n\n{order.notes}' if order.notes else new_note

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Server error. Please try again.'}), 500

    log_action(
        action='fulfillment_note_added',
        user_id=current_user_id(),
        store_id=None,
        entity_type='fulfillment_order',
        entity_id=order_id,
        old_value=None,
        new_value=new_note,
    )

    return jsonify({'notes': order.notes}), 200
