"""add sync_events table and stores.force_full_resync

Revision ID: d6e7f8a9b0c1
Revises: c8765b724747
Create Date: 2026-05-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd6e7f8a9b0c1'
down_revision = 'c8765b724747'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'stores',
        sa.Column('force_full_resync', sa.Boolean(), nullable=False, server_default='false'),
    )

    op.create_table(
        'sync_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('store_id', sa.Integer(), nullable=False),
        sa.Column('operation', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('error_code', sa.String(length=100), nullable=True),
        sa.Column('discarded', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('item_uuid', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['store_id'], ['stores.store_id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sync_events_store_id', 'sync_events', ['store_id'])
    op.create_index('ix_sync_events_created_at', 'sync_events', ['created_at'])
    op.create_index('ix_sync_events_discarded', 'sync_events', ['discarded'])


def downgrade():
    op.drop_index('ix_sync_events_discarded', table_name='sync_events')
    op.drop_index('ix_sync_events_created_at', table_name='sync_events')
    op.drop_index('ix_sync_events_store_id', table_name='sync_events')
    op.drop_table('sync_events')
    op.drop_column('stores', 'force_full_resync')
