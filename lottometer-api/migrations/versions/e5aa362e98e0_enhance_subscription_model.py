"""enhance_subscription_model

Revision ID: e5aa362e98e0
Revises: 2c7a78a8ac4c
Create Date: 2026-05-02 01:01:28.298160

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e5aa362e98e0'
down_revision = '2c7a78a8ac4c'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('subscriptions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('plan_price', sa.Numeric(precision=10, scale=2), nullable=True))
        batch_op.add_column(sa.Column('billing_email', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('card_last4', sa.String(length=4), nullable=True))
        batch_op.add_column(sa.Column('card_brand', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('cancel_at_period_end', sa.Boolean(), server_default='false', nullable=False))
        batch_op.add_column(sa.Column('cancelled_reason', sa.String(length=250), nullable=True))
        batch_op.add_column(sa.Column('notes', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('subscriptions', schema=None) as batch_op:
        batch_op.drop_column('notes')
        batch_op.drop_column('cancelled_reason')
        batch_op.drop_column('cancel_at_period_end')
        batch_op.drop_column('card_brand')
        batch_op.drop_column('card_last4')
        batch_op.drop_column('billing_email')
        batch_op.drop_column('plan_price')
