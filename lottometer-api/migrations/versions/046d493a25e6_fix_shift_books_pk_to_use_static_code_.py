"""fix shift_books PK to use static_code instead of barcode

Revision ID: 046d493a25e6
Revises: b018972e2e91
Create Date: 2026-04-26 04:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '046d493a25e6'
down_revision = 'b018972e2e91'
branch_labels = None
depends_on = None


def upgrade():
    # Drop and recreate shift_books with new PK (shift_id, static_code, scan_type).
    # Safe because no scan data has been collected yet at this point.
    op.drop_table('shift_books')

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
        sa.ForeignKeyConstraint(['shift_id'], ['shift_details.shift_id']),
        sa.ForeignKeyConstraint(['slot_id'], ['slots.slot_id']),
        sa.ForeignKeyConstraint(['store_id'], ['stores.store_id']),
        sa.ForeignKeyConstraint(['scanned_by_user_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('shift_id', 'static_code', 'scan_type'),
        sa.CheckConstraint(
            "scan_type IN ('open', 'close')",
            name='ck_shift_books_scan_type',
        ),
        sa.CheckConstraint(
            "scan_source IN ('scanned', 'carried_forward', 'whole_book_sale', 'returned_to_vendor')",
            name='ck_shift_books_scan_source',
        ),
    )
    op.create_index(
        'ix_shift_books_store_id', 'shift_books', ['store_id']
    )
    op.create_index(
        'ix_shift_books_store_scanned_at', 'shift_books', ['store_id', 'scanned_at']
    )


def downgrade():
    op.drop_index('ix_shift_books_store_scanned_at', table_name='shift_books')
    op.drop_index('ix_shift_books_store_id', table_name='shift_books')
    op.drop_table('shift_books')

    op.create_table(
        'shift_books',
        sa.Column('shift_id', sa.Integer(), nullable=False),
        sa.Column('barcode', sa.String(length=100), nullable=False),
        sa.Column('scan_type', sa.String(length=10), nullable=False),
        sa.Column('start_at_scan', sa.Integer(), nullable=False),
        sa.Column('is_last_ticket', sa.Boolean(), nullable=False),
        sa.Column('scan_source', sa.String(length=25), nullable=False),
        sa.Column('slot_id', sa.Integer(), nullable=False),
        sa.Column('store_id', sa.Integer(), nullable=False),
        sa.Column('scanned_at', sa.DateTime(), nullable=False),
        sa.Column('scanned_by_user_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['shift_id'], ['shift_details.shift_id']),
        sa.ForeignKeyConstraint(['slot_id'], ['slots.slot_id']),
        sa.ForeignKeyConstraint(['store_id'], ['stores.store_id']),
        sa.ForeignKeyConstraint(['scanned_by_user_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('shift_id', 'barcode', 'scan_type'),
    )