"""create complaints table

Revision ID: a1b2c3d4e5f6
Revises: 4a3c3faa8120
Create Date: 2026-05-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '4a3c3faa8120'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'complaints',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('store_id', sa.Integer(), nullable=False),
        sa.Column('subject', sa.String(length=255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='open'),
        sa.Column('priority', sa.String(length=20), nullable=False, server_default='medium'),
        sa.Column('staff_reply', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['store_id'], ['stores.store_id']),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint(
            "status IN ('open', 'resolved')",
            name='ck_complaints_status',
        ),
        sa.CheckConstraint(
            "priority IN ('low', 'medium', 'high')",
            name='ck_complaints_priority',
        ),
    )
    op.create_index('ix_complaints_store_id', 'complaints', ['store_id'])
    op.create_index('ix_complaints_status', 'complaints', ['status'])
    op.create_index('ix_complaints_created_at', 'complaints', ['created_at'])


def downgrade():
    op.drop_index('ix_complaints_created_at', table_name='complaints')
    op.drop_index('ix_complaints_status', table_name='complaints')
    op.drop_index('ix_complaints_store_id', table_name='complaints')
    op.drop_table('complaints')
