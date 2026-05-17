from datetime import datetime, timezone
from app.extensions import db

VALID_STATES = [
    'application_received',
    'payment_link_sent',
    'paid_awaiting_order',
    'device_ordered',
    'device_received_provisioning',
    'ready_to_ship',
    'shipped',
    'delivered',
    'active',
    'cancelled',
]

ALLOWED_TRANSITIONS = {
    'application_received':         ['payment_link_sent', 'cancelled'],
    'payment_link_sent':            ['paid_awaiting_order', 'cancelled'],
    'paid_awaiting_order':          ['device_ordered', 'cancelled'],
    'device_ordered':               ['device_received_provisioning', 'cancelled'],
    'device_received_provisioning': ['ready_to_ship', 'cancelled'],
    'ready_to_ship':                ['shipped', 'cancelled'],
    'shipped':                      ['delivered', 'cancelled'],
    'delivered':                    ['active', 'cancelled'],
    'active':                       ['cancelled'],
    'cancelled':                    [],
}

STATE_TIMESTAMP_MAP = {
    'payment_link_sent':            'payment_link_sent_at',
    'paid_awaiting_order':          'paid_at',
    'device_ordered':               'device_ordered_at',
    'device_received_provisioning': 'device_received_at',
    'ready_to_ship':                'ready_to_ship_at',
    'shipped':                      'shipped_at',
    'delivered':                    'delivered_at',
    'active':                       'activated_at',
    'cancelled':                    'cancelled_at',
}


class FulfillmentOrder(db.Model):
    __tablename__ = 'fulfillment_orders'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    submission_id = db.Column(
        db.Integer,
        db.ForeignKey('contact_submissions.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )

    state = db.Column(
        db.String(50),
        nullable=False,
        default='application_received',
        server_default='application_received',
    )

    # Applicant snapshot (denormalized for speed — source of truth stays in ContactSubmission)
    full_name     = db.Column(db.String(150), nullable=True)
    email         = db.Column(db.String(150), nullable=True)
    business_name = db.Column(db.String(150), nullable=True)
    phone         = db.Column(db.String(50),  nullable=True)
    state_abbr    = db.Column(db.String(10),  nullable=True)  # US state abbreviation

    # Shipping destination
    shipping_name    = db.Column(db.String(150), nullable=True)
    shipping_address = db.Column(db.String(255), nullable=True)
    shipping_address2 = db.Column(db.String(100), nullable=True)
    shipping_city    = db.Column(db.String(100), nullable=True)
    shipping_state   = db.Column(db.String(50),  nullable=True)
    shipping_zip     = db.Column(db.String(20),  nullable=True)

    # Operational fields
    tracking_number = db.Column(db.String(100), nullable=True)
    payment_link    = db.Column(db.String(500), nullable=True)
    device_serial   = db.Column(db.String(100), nullable=True)
    notes           = db.Column(db.Text, nullable=True)

    # State transition timestamps
    payment_link_sent_at = db.Column(db.DateTime, nullable=True)
    paid_at              = db.Column(db.DateTime, nullable=True)
    device_ordered_at    = db.Column(db.DateTime, nullable=True)
    device_received_at   = db.Column(db.DateTime, nullable=True)
    ready_to_ship_at     = db.Column(db.DateTime, nullable=True)
    shipped_at           = db.Column(db.DateTime, nullable=True)
    delivered_at         = db.Column(db.DateTime, nullable=True)
    activated_at         = db.Column(db.DateTime, nullable=True)
    cancelled_at         = db.Column(db.DateTime, nullable=True)

    created_at  = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at  = db.Column(db.DateTime, nullable=False,
                            default=lambda: datetime.now(timezone.utc),
                            onupdate=lambda: datetime.now(timezone.utc))

    submission = db.relationship('ContactSubmission', backref='fulfillment_orders', lazy='select')

    def can_transition_to(self, new_state: str) -> bool:
        return new_state in ALLOWED_TRANSITIONS.get(self.state, [])

    def apply_transition(self, new_state: str) -> None:
        ts_col = STATE_TIMESTAMP_MAP.get(new_state)
        if ts_col and getattr(self, ts_col) is None:
            setattr(self, ts_col, datetime.now(timezone.utc))
        self.state = new_state
        self.updated_at = datetime.now(timezone.utc)

    def to_dict(self, include_submission: bool = False) -> dict:
        d = {
            'id':               self.id,
            'submission_id':    self.submission_id,
            'state':            self.state,
            'full_name':        self.full_name,
            'email':            self.email,
            'business_name':    self.business_name,
            'phone':            self.phone,
            'state_abbr':       self.state_abbr,
            'shipping_name':    self.shipping_name,
            'shipping_address': self.shipping_address,
            'shipping_address2':self.shipping_address2,
            'shipping_city':    self.shipping_city,
            'shipping_state':   self.shipping_state,
            'shipping_zip':     self.shipping_zip,
            'tracking_number':  self.tracking_number,
            'payment_link':     self.payment_link,
            'device_serial':    self.device_serial,
            'notes':            self.notes,
            'payment_link_sent_at': _iso(self.payment_link_sent_at),
            'paid_at':              _iso(self.paid_at),
            'device_ordered_at':    _iso(self.device_ordered_at),
            'device_received_at':   _iso(self.device_received_at),
            'ready_to_ship_at':     _iso(self.ready_to_ship_at),
            'shipped_at':           _iso(self.shipped_at),
            'delivered_at':         _iso(self.delivered_at),
            'activated_at':         _iso(self.activated_at),
            'cancelled_at':         _iso(self.cancelled_at),
            'created_at':           _iso(self.created_at),
            'updated_at':           _iso(self.updated_at),
        }
        if include_submission and self.submission:
            d['submission'] = {
                'id':            self.submission.id,
                'how_heard':     self.submission.how_heard,
                'num_employees': self.submission.num_employees,
                'message':       self.submission.message,
                'extra_data':    self.submission.extra_data,
                'status':        self.submission.status,
                'created_at':    _iso(self.submission.created_at),
            }
        return d


def _iso(dt) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc).isoformat()
    return dt.isoformat()
