"""One-time script to create LottoMeter HQ store + superadmin user.

Run once after the initial migration:
    flask db upgrade
    python create_superadmin.py
"""

from app import create_app
from app.extensions import db
from app.models.store import Store
from app.models.user import User
import bcrypt

app = create_app()
with app.app_context():
    if User.query.filter_by(role="superadmin").first():
        print("Superadmin already exists. Aborting.")
        exit(1)

    store = Store(
        store_name="LottoMeter HQ",
        store_code="LMHQ",
    )
    db.session.add(store)
    db.session.flush()

    password_hash = bcrypt.hashpw(
        b"superadmin1234",
        bcrypt.gensalt(),
    ).decode()

    superadmin = User(
        username="superadmin",
        password_hash=password_hash,
        role="superadmin",
        store_id=store.store_id,
    )
    db.session.add(superadmin)
    db.session.commit()
    print(f"Superadmin created. Store ID: {store.store_id}, User ID: {superadmin.user_id}")
    print("Login with store_code=LMHQ, username=superadmin, password=superadmin1234")
    print("CHANGE THE PASSWORD after first login.")
