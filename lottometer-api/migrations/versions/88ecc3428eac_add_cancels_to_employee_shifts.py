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
    with op.batch_alter_table('employee_shifts') as batch_op:
        batch_op.add_column(
            sa.Column('cancels', sa.Numeric(precision=10, scale=2),
                      nullable=True)
        )


def downgrade():
    with op.batch_alter_table('employee_shifts') as batch_op:
        batch_op.drop_column('cancels')
