"""One-off backfill: assign UUIDs to any EmployeeShift or BusinessDay rows
that were created before UUID generation was wired into the service layer.

Run once on production after deploying the UUID fix:
    python scripts/backfill_shift_uuids.py

Safe to re-run — skips rows that already have a UUID.
"""

import sys
import os
import uuid as uuid_lib

# Allow running from the repo root or from scripts/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import create_app
from app.extensions import db
from app.models.employee_shift import EmployeeShift
from app.models.business_day import BusinessDay

app = create_app()

with app.app_context():
    shifts = db.session.query(EmployeeShift).filter(EmployeeShift.uuid.is_(None)).all()
    for s in shifts:
        s.uuid = str(uuid_lib.uuid4())

    days = db.session.query(BusinessDay).filter(BusinessDay.uuid.is_(None)).all()
    for d in days:
        d.uuid = str(uuid_lib.uuid4())

    db.session.commit()
    print(f"Backfilled {len(shifts)} shift(s) and {len(days)} business day(s) with new UUIDs.")
