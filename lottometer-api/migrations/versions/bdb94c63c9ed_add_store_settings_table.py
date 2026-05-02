"""add_store_settings_table

Revision ID: bdb94c63c9ed
Revises: e5aa362e98e0
Create Date: 2026-05-02 01:06:14.233491

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bdb94c63c9ed'
down_revision = 'e5aa362e98e0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'store_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('store_id', sa.Integer(), nullable=False),
        sa.Column('timezone', sa.String(length=50), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False),
        sa.Column('business_hours_start', sa.String(length=5), nullable=True),
        sa.Column('business_hours_end', sa.String(length=5), nullable=True),
        sa.Column('max_employees', sa.Integer(), nullable=False),
        sa.Column('auto_close_business_day', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('notify_email', sa.String(length=150), nullable=True),
        sa.Column('notify_on_variance', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('notify_on_shift_close', sa.Boolean(), server_default='false', nullable=False),
        sa.ForeignKeyConstraint(['store_id'], ['stores.store_id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('store_id'),
    )


def downgrade():
    op.drop_table('store_settings')
