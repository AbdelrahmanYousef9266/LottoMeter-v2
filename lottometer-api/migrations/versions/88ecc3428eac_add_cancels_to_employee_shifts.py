"""add_cancels_to_employee_shifts

Revision ID: 88ecc3428eac
Revises: bdb94c63c9ed
Create Date: 2026-05-02 19:19:33.484976

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '88ecc3428eac'
down_revision = 'bdb94c63c9ed'
branch_labels = None
depends_on = None


def upgrade():
    # UUID fields (from deleted 50445ec5cb8b)
    with op.batch_alter_table('business_days') as batch_op:
        batch_op.add_column(sa.Column('uuid', sa.String(36), nullable=True))
        batch_op.create_index('ix_business_days_uuid', ['uuid'])

    with op.batch_alter_table('employee_shifts') as batch_op:
        batch_op.add_column(sa.Column('uuid', sa.String(36), nullable=True))
        batch_op.create_index('ix_employee_shifts_uuid', ['uuid'])

    with op.batch_alter_table('shift_books') as batch_op:
        batch_op.add_column(sa.Column('uuid', sa.String(36), nullable=True))
        batch_op.create_index('ix_shift_books_uuid', ['uuid'])

    # Cancels column
    with op.batch_alter_table('employee_shifts') as batch_op:
        batch_op.add_column(
            sa.Column('cancels', sa.Numeric(precision=10, scale=2),
                      nullable=True)
        )


def downgrade():
    with op.batch_alter_table('employee_shifts') as batch_op:
        batch_op.drop_column('cancels')
        batch_op.drop_index('ix_employee_shifts_uuid')
        batch_op.drop_column('uuid')

    with op.batch_alter_table('shift_books') as batch_op:
        batch_op.drop_index('ix_shift_books_uuid')
        batch_op.drop_column('uuid')

    with op.batch_alter_table('business_days') as batch_op:
        batch_op.drop_index('ix_business_days_uuid')
        batch_op.drop_column('uuid')
