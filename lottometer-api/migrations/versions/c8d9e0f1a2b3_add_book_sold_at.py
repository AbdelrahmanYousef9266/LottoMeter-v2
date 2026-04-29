"""add sold_at column to books

Revision ID: c8d9e0f1a2b3
Revises: 1ca6f7f8dca9
Create Date: 2026-04-29

"""
from alembic import op
import sqlalchemy as sa


revision = 'c8d9e0f1a2b3'
down_revision = '1ca6f7f8dca9'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('books', schema=None) as batch_op:
        batch_op.add_column(sa.Column('sold_at', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('books', schema=None) as batch_op:
        batch_op.drop_column('sold_at')
