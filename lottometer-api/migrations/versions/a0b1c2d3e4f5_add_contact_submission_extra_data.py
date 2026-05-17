"""add extra_data column to contact_submissions

Revision ID: a0b1c2d3e4f5
Revises: f9e0b1c2d3e4
Create Date: 2026-05-17 00:00:00.000000

extra_data is a JSON text blob that stores extended apply-form fields that
don't map 1-to-1 to existing columns (shipping address, confirmation flags, etc.).
Keeping it as a flexible blob avoids migrating new form fields every time the
apply form evolves.
"""
from alembic import op
import sqlalchemy as sa


revision = 'a0b1c2d3e4f5'
down_revision = 'f9e0b1c2d3e4'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'contact_submissions',
        sa.Column('extra_data', sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column('contact_submissions', 'extra_data')
