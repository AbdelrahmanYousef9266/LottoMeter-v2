"""add_cancels_to_employee_shifts

Revision ID: 628aef7c4bec
Revises: bdb94c63c9ed
Create Date: 2026-05-02 18:46:19.620921

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '628aef7c4bec'
down_revision = '50445ec5cb8b'
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
