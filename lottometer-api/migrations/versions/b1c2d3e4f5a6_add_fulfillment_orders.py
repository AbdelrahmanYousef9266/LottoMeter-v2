"""add fulfillment_orders table

Revision ID: b1c2d3e4f5a6
Revises: a0b1c2d3e4f5
Create Date: 2026-05-17 00:00:00.000000

Separate model (Option B) so ContactSubmission stays clean.
One FulfillmentOrder per apply submission; tracks the 9-state
device fulfillment lifecycle with per-state timestamps.
"""
from alembic import op
import sqlalchemy as sa


revision = 'b1c2d3e4f5a6'
down_revision = 'a0b1c2d3e4f5'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'fulfillment_orders',
        sa.Column('id',              sa.Integer(),     primary_key=True, autoincrement=True),
        sa.Column('submission_id',   sa.Integer(),     sa.ForeignKey('contact_submissions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('state',           sa.String(50),    nullable=False, server_default='application_received'),

        # Applicant snapshot
        sa.Column('full_name',       sa.String(150),   nullable=True),
        sa.Column('email',           sa.String(150),   nullable=True),
        sa.Column('business_name',   sa.String(150),   nullable=True),
        sa.Column('phone',           sa.String(50),    nullable=True),
        sa.Column('state_abbr',      sa.String(10),    nullable=True),

        # Shipping
        sa.Column('shipping_name',     sa.String(150), nullable=True),
        sa.Column('shipping_address',  sa.String(255), nullable=True),
        sa.Column('shipping_address2', sa.String(100), nullable=True),
        sa.Column('shipping_city',     sa.String(100), nullable=True),
        sa.Column('shipping_state',    sa.String(50),  nullable=True),
        sa.Column('shipping_zip',      sa.String(20),  nullable=True),

        # Operational
        sa.Column('tracking_number', sa.String(100),   nullable=True),
        sa.Column('payment_link',    sa.String(500),   nullable=True),
        sa.Column('device_serial',   sa.String(100),   nullable=True),
        sa.Column('notes',           sa.Text(),        nullable=True),

        # State timestamps
        sa.Column('payment_link_sent_at', sa.DateTime(), nullable=True),
        sa.Column('paid_at',              sa.DateTime(), nullable=True),
        sa.Column('device_ordered_at',    sa.DateTime(), nullable=True),
        sa.Column('device_received_at',   sa.DateTime(), nullable=True),
        sa.Column('ready_to_ship_at',     sa.DateTime(), nullable=True),
        sa.Column('shipped_at',           sa.DateTime(), nullable=True),
        sa.Column('delivered_at',         sa.DateTime(), nullable=True),
        sa.Column('activated_at',         sa.DateTime(), nullable=True),
        sa.Column('cancelled_at',         sa.DateTime(), nullable=True),

        sa.Column('created_at',  sa.DateTime(), nullable=False),
        sa.Column('updated_at',  sa.DateTime(), nullable=False),
    )
    op.create_index('ix_fulfillment_orders_submission_id', 'fulfillment_orders', ['submission_id'])
    op.create_index('ix_fulfillment_orders_state',         'fulfillment_orders', ['state'])
    op.create_index('ix_fulfillment_orders_email',         'fulfillment_orders', ['email'])


def downgrade():
    op.drop_index('ix_fulfillment_orders_email',         table_name='fulfillment_orders')
    op.drop_index('ix_fulfillment_orders_state',         table_name='fulfillment_orders')
    op.drop_index('ix_fulfillment_orders_submission_id', table_name='fulfillment_orders')
    op.drop_table('fulfillment_orders')
