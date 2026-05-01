"""add_suspended_and_submission_fields

Revision ID: a2b3c4d5e6f7
Revises: f35c5e2daed6
Create Date: 2026-05-01 05:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a2b3c4d5e6f7'
down_revision = 'f35c5e2daed6'
branch_labels = None
depends_on = None


def upgrade():
    # stores.suspended
    op.add_column('stores',
        sa.Column('suspended', sa.Boolean(), nullable=False, server_default='false')
    )

    # contact_submissions: status, notes, reviewed_at
    op.add_column('contact_submissions',
        sa.Column('status', sa.String(length=20), nullable=False, server_default='new')
    )
    op.add_column('contact_submissions',
        sa.Column('notes', sa.Text(), nullable=True)
    )
    op.add_column('contact_submissions',
        sa.Column('reviewed_at', sa.DateTime(), nullable=True)
    )


def downgrade():
    op.drop_column('contact_submissions', 'reviewed_at')
    op.drop_column('contact_submissions', 'notes')
    op.drop_column('contact_submissions', 'status')
    op.drop_column('stores', 'suspended')
