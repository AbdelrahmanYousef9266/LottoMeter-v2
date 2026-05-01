"""add_contact_submissions_table

Revision ID: f35c5e2daed6
Revises: c3d4e5f6a1b2
Create Date: 2026-05-01 04:54:29.723258

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f35c5e2daed6'
down_revision = 'c3d4e5f6a1b2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'contact_submissions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('submission_type', sa.String(length=20), nullable=False),
        sa.Column('full_name', sa.String(length=150), nullable=False),
        sa.Column('business_name', sa.String(length=150), nullable=True),
        sa.Column('email', sa.String(length=150), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('num_employees', sa.String(length=20), nullable=True),
        sa.Column('how_heard', sa.String(length=50), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('state', sa.String(length=50), nullable=True),
        sa.Column('store_count', sa.Integer(), nullable=True),
        sa.Column('current_process', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('contact_submissions')
