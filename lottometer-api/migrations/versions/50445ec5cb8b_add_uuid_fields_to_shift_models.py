"""add_uuid_fields_to_shift_models

Revision ID: 50445ec5cb8b
Revises: bdb94c63c9ed
Create Date: 2026-05-02 02:27:34.045082

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '50445ec5cb8b'
down_revision = 'bdb94c63c9ed'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('business_days', schema=None) as batch_op:
        batch_op.add_column(sa.Column('uuid', sa.String(length=36), nullable=True))
        batch_op.create_index(batch_op.f('ix_business_days_uuid'), ['uuid'], unique=False)

    with op.batch_alter_table('employee_shifts', schema=None) as batch_op:
        batch_op.add_column(sa.Column('uuid', sa.String(length=36), nullable=True))
        batch_op.create_index(batch_op.f('ix_employee_shifts_uuid'), ['uuid'], unique=False)

    with op.batch_alter_table('shift_books', schema=None) as batch_op:
        batch_op.add_column(sa.Column('uuid', sa.String(length=36), nullable=True))
        batch_op.create_index(batch_op.f('ix_shift_books_uuid'), ['uuid'], unique=False)


def downgrade():
    with op.batch_alter_table('shift_books', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_shift_books_uuid'))
        batch_op.drop_column('uuid')

    with op.batch_alter_table('employee_shifts', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_employee_shifts_uuid'))
        batch_op.drop_column('uuid')

    with op.batch_alter_table('business_days', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_business_days_uuid'))
        batch_op.drop_column('uuid')
