"""add_report_settings_to_store_settings

Revision ID: 4a3c3faa8120
Revises: 88ecc3428eac
Create Date: 2026-05-04 12:52:28.104721

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4a3c3faa8120'
down_revision = '88ecc3428eac'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('store_settings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('report_email', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('report_format', sa.String(length=10), server_default='html', nullable=False))
        batch_op.add_column(sa.Column('report_delay_hours', sa.Float(), server_default='1.0', nullable=False))
        batch_op.add_column(sa.Column('report_enabled', sa.Boolean(), server_default='true', nullable=False))


def downgrade():
    with op.batch_alter_table('store_settings', schema=None) as batch_op:
        batch_op.drop_column('report_enabled')
        batch_op.drop_column('report_delay_hours')
        batch_op.drop_column('report_format')
        batch_op.drop_column('report_email')
