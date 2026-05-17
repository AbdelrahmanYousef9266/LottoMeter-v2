"""add indexes for global superadmin search

Revision ID: f9e0b1c2d3e4
Revises: d6e7f8a9b0c1
Create Date: 2026-05-17 00:00:00.000000

Indexes added:
  stores.store_name, stores.owner_name, stores.email
  users.username
  complaints.subject
  business_days.business_date  (already covered by the compound unique index;
                                 adding a standalone index improves single-column lookups)
  contact_submissions.full_name, contact_submissions.email, contact_submissions.business_name

LIKE '%query%' queries cannot use B-tree indexes, but prefix-LIKE ('query%') can.
These indexes also reduce overhead when the planner uses them in combination with
other conditions or when the table grows large.
"""
from alembic import op


revision = 'f9e0b1c2d3e4'
down_revision = 'd6e7f8a9b0c1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index('ix_stores_store_name',  'stores', ['store_name'])
    op.create_index('ix_stores_owner_name',  'stores', ['owner_name'])
    op.create_index('ix_stores_email',        'stores', ['email'])

    op.create_index('ix_users_username',      'users',  ['username'])

    op.create_index('ix_complaints_subject',  'complaints', ['subject'])

    op.create_index('ix_business_days_date',  'business_days', ['business_date'])

    op.create_index('ix_submissions_full_name',     'contact_submissions', ['full_name'])
    op.create_index('ix_submissions_email',         'contact_submissions', ['email'])
    op.create_index('ix_submissions_business_name', 'contact_submissions', ['business_name'])


def downgrade():
    op.drop_index('ix_submissions_business_name', table_name='contact_submissions')
    op.drop_index('ix_submissions_email',         table_name='contact_submissions')
    op.drop_index('ix_submissions_full_name',     table_name='contact_submissions')

    op.drop_index('ix_business_days_date',  table_name='business_days')

    op.drop_index('ix_complaints_subject',  table_name='complaints')

    op.drop_index('ix_users_username',      table_name='users')

    op.drop_index('ix_stores_email',        table_name='stores')
    op.drop_index('ix_stores_owner_name',   table_name='stores')
    op.drop_index('ix_stores_store_name',   table_name='stores')
