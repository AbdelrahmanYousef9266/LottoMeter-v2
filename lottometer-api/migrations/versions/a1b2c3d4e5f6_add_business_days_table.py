"""add business_days table

Revision ID: a1b2c3d4e5f6
Revises: c8d9e0f1a2b3
Create Date: 2026-04-30

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = 'c8d9e0f1a2b3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'business_days',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('store_id', sa.Integer(), nullable=False),
        sa.Column('business_date', sa.Date(), nullable=False),
        sa.Column('opened_at', sa.DateTime(), nullable=False),
        sa.Column('closed_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='open'),
        sa.Column('total_sales', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('total_variance', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.CheckConstraint(
            "status IN ('open', 'closed', 'auto_closed')",
            name='ck_business_day_status',
        ),
        sa.ForeignKeyConstraint(['store_id'], ['stores.store_id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('store_id', 'business_date', name='uq_business_day_per_store'),
    )
    op.create_index('ix_business_days_store_id', 'business_days', ['store_id'])


def downgrade():
    op.drop_index('ix_business_days_store_id', table_name='business_days')
    op.drop_table('business_days')
