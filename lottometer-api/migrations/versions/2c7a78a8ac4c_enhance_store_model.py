"""enhance_store_model

Revision ID: 2c7a78a8ac4c
Revises: d5e6f7a8b9c0
Create Date: 2026-05-02 00:58:44.002044

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2c7a78a8ac4c'
down_revision = 'd5e6f7a8b9c0'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('stores', schema=None) as batch_op:
        batch_op.add_column(sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False))
        batch_op.add_column(sa.Column('email', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('phone', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('address', sa.String(length=250), nullable=True))
        batch_op.add_column(sa.Column('city', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('state', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('zip_code', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('owner_name', sa.String(length=150), nullable=True))
        batch_op.add_column(sa.Column('created_by', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('notes', sa.Text(), nullable=True))
        batch_op.create_foreign_key('fk_stores_created_by', 'users', ['created_by'], ['user_id'], use_alter=True)


def downgrade():
    with op.batch_alter_table('stores', schema=None) as batch_op:
        batch_op.drop_constraint('fk_stores_created_by', type_='foreignkey')
        batch_op.drop_column('notes')
        batch_op.drop_column('created_by')
        batch_op.drop_column('owner_name')
        batch_op.drop_column('zip_code')
        batch_op.drop_column('state')
        batch_op.drop_column('city')
        batch_op.drop_column('address')
        batch_op.drop_column('phone')
        batch_op.drop_column('email')
        batch_op.drop_column('is_active')
