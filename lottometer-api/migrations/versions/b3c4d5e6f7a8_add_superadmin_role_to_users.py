"""add_superadmin_role_to_users

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-05-01 06:00:00.000000

"""
from alembic import op


revision = 'b3c4d5e6f7a8'
down_revision = 'a2b3c4d5e6f7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_check_constraint(
        'ck_users_role',
        'users',
        "role IN ('admin', 'employee', 'superadmin')",
    )


def downgrade():
    op.drop_constraint('ck_users_role', 'users', type_='check')
