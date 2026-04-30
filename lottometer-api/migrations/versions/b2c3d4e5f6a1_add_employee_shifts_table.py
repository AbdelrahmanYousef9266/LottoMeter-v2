"""add employee_shifts table

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-04-30

"""
from alembic import op
import sqlalchemy as sa


revision = 'b2c3d4e5f6a1'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'employee_shifts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('business_day_id', sa.Integer(), nullable=False),
        sa.Column('store_id', sa.Integer(), nullable=False),
        sa.Column('employee_id', sa.Integer(), nullable=False),
        sa.Column('shift_number', sa.Integer(), nullable=False),
        sa.Column('opened_at', sa.DateTime(), nullable=False),
        sa.Column('closed_at', sa.DateTime(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='open'),
        # Financial close fields
        sa.Column('cash_in_hand', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('gross_sales', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('cash_out', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('tickets_total', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('expected_cash', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('difference', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('shift_status', sa.String(length=20), nullable=True),
        sa.Column('closed_by_user_id', sa.Integer(), nullable=True),
        # Void fields
        sa.Column('voided', sa.Boolean(), nullable=False),
        sa.Column('voided_at', sa.DateTime(), nullable=True),
        sa.Column('voided_by_user_id', sa.Integer(), nullable=True),
        sa.Column('void_reason', sa.String(length=500), nullable=True),
        # Constraints
        sa.CheckConstraint("status IN ('open', 'closed')", name='ck_employee_shift_status'),
        sa.CheckConstraint(
            "shift_status IS NULL OR shift_status IN ('correct', 'over', 'short')",
            name='ck_employee_shift_financial_status',
        ),
        sa.CheckConstraint(
            'NOT voided OR void_reason IS NOT NULL',
            name='ck_employee_shift_void_requires_reason',
        ),
        sa.ForeignKeyConstraint(['business_day_id'], ['business_days.id']),
        sa.ForeignKeyConstraint(['closed_by_user_id'], ['users.user_id']),
        sa.ForeignKeyConstraint(['employee_id'], ['users.user_id']),
        sa.ForeignKeyConstraint(['store_id'], ['stores.store_id']),
        sa.ForeignKeyConstraint(['voided_by_user_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('business_day_id', 'shift_number', name='uq_shift_number_per_business_day'),
    )
    with op.batch_alter_table('employee_shifts', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_employee_shifts_business_day_id'), ['business_day_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_employee_shifts_store_id'), ['store_id'], unique=False)
        batch_op.create_index(
            'uq_one_open_employee_shift_per_store',
            ['store_id'],
            unique=True,
            sqlite_where=sa.text("status = 'open' AND voided = 0"),
            postgresql_where=sa.text("status = 'open' AND voided = FALSE"),
        )


def downgrade():
    with op.batch_alter_table('employee_shifts', schema=None) as batch_op:
        batch_op.drop_index(
            'uq_one_open_employee_shift_per_store',
            sqlite_where=sa.text("status = 'open' AND voided = 0"),
            postgresql_where=sa.text("status = 'open' AND voided = FALSE"),
        )
        batch_op.drop_index(batch_op.f('ix_employee_shifts_store_id'))
        batch_op.drop_index(batch_op.f('ix_employee_shifts_business_day_id'))

    op.drop_table('employee_shifts')
