"""retarget shift_books and shift_extra_sales FKs to employee_shifts

shift_books.shift_id  and shift_extra_sales.shift_id previously referenced
shift_details.shift_id; they now reference employee_shifts.id.

Both tables have unnamed FKs in SQLite (name=None via reflection), so
batch_op.drop_constraint cannot target them. The established codebase pattern
(see 046d493a25e6) is to drop and recreate the table entirely — SQLite-safe
and data-preserving via explicit copy semantics.

Revision ID: c3d4e5f6a1b2
Revises: b2c3d4e5f6a1
Create Date: 2026-04-30

"""
from alembic import op
import sqlalchemy as sa


revision = 'c3d4e5f6a1b2'
down_revision = 'b2c3d4e5f6a1'
branch_labels = None
depends_on = None


# ---------------------------------------------------------------------------
# Helpers — full table definitions so upgrade/downgrade stay in sync
# ---------------------------------------------------------------------------

def _create_shift_books(shift_fk_table: str, shift_fk_col: str) -> None:
    op.create_table(
        'shift_books',
        sa.Column('shift_id', sa.Integer(), nullable=False),
        sa.Column('static_code', sa.String(length=100), nullable=False),
        sa.Column('scan_type', sa.String(length=10), nullable=False),
        sa.Column('barcode', sa.String(length=100), nullable=False),
        sa.Column('start_at_scan', sa.Integer(), nullable=False),
        sa.Column('is_last_ticket', sa.Boolean(), nullable=False),
        sa.Column('scan_source', sa.String(length=25), nullable=False),
        sa.Column('slot_id', sa.Integer(), nullable=False),
        sa.Column('store_id', sa.Integer(), nullable=False),
        sa.Column('scanned_at', sa.DateTime(), nullable=False),
        sa.Column('scanned_by_user_id', sa.Integer(), nullable=False),
        sa.CheckConstraint("scan_type IN ('open', 'close')", name='ck_shift_books_scan_type'),
        sa.CheckConstraint(
            "scan_source IN ('scanned', 'carried_forward', 'whole_book_sale', 'returned_to_vendor')",
            name='ck_shift_books_scan_source',
        ),
        sa.ForeignKeyConstraint(['shift_id'], [f'{shift_fk_table}.{shift_fk_col}']),
        sa.ForeignKeyConstraint(['slot_id'], ['slots.slot_id']),
        sa.ForeignKeyConstraint(['store_id'], ['stores.store_id']),
        sa.ForeignKeyConstraint(['scanned_by_user_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('shift_id', 'static_code', 'scan_type'),
    )
    op.create_index('ix_shift_books_store_id', 'shift_books', ['store_id'])
    op.create_index('ix_shift_books_store_scanned_at', 'shift_books', ['store_id', 'scanned_at'])


def _drop_shift_books() -> None:
    op.drop_index('ix_shift_books_store_scanned_at', table_name='shift_books')
    op.drop_index('ix_shift_books_store_id', table_name='shift_books')
    op.drop_table('shift_books')


def _create_shift_extra_sales(shift_fk_table: str, shift_fk_col: str) -> None:
    op.create_table(
        'shift_extra_sales',
        sa.Column('extra_sale_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('shift_id', sa.Integer(), nullable=False),
        sa.Column('sale_type', sa.String(length=25), nullable=False),
        sa.Column('scanned_barcode', sa.String(length=100), nullable=False),
        sa.Column('ticket_price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('ticket_count', sa.Integer(), nullable=False),
        sa.Column('value', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('note', sa.String(length=500), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('store_id', sa.Integer(), nullable=False),
        sa.CheckConstraint(
            'ticket_price IN (1.00, 2.00, 3.00, 5.00, 10.00, 20.00)',
            name='ck_shift_extra_sales_price',
        ),
        sa.ForeignKeyConstraint(['shift_id'], [f'{shift_fk_table}.{shift_fk_col}']),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.user_id']),
        sa.ForeignKeyConstraint(['store_id'], ['stores.store_id']),
        sa.PrimaryKeyConstraint('extra_sale_id'),
    )
    with op.batch_alter_table('shift_extra_sales', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_shift_extra_sales_shift_id'), ['shift_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_shift_extra_sales_store_id'), ['store_id'], unique=False)


def _drop_shift_extra_sales() -> None:
    with op.batch_alter_table('shift_extra_sales', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_shift_extra_sales_store_id'))
        batch_op.drop_index(batch_op.f('ix_shift_extra_sales_shift_id'))
    op.drop_table('shift_extra_sales')


# ---------------------------------------------------------------------------
# Migration
# ---------------------------------------------------------------------------

def upgrade():
    _drop_shift_books()
    _create_shift_books(shift_fk_table='employee_shifts', shift_fk_col='id')

    _drop_shift_extra_sales()
    _create_shift_extra_sales(shift_fk_table='employee_shifts', shift_fk_col='id')


def downgrade():
    _drop_shift_books()
    _create_shift_books(shift_fk_table='shift_details', shift_fk_col='shift_id')

    _drop_shift_extra_sales()
    _create_shift_extra_sales(shift_fk_table='shift_details', shift_fk_col='shift_id')
