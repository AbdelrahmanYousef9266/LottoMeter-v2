from app import create_app
from flask_migrate import upgrade

app = create_app()
with app.app_context():
    from app.extensions import db

    # Wipe the entire schema so no stale tables remain
    db.session.execute(db.text('DROP SCHEMA public CASCADE'))
    db.session.execute(db.text('CREATE SCHEMA public'))
    db.session.commit()

    # Recreate via migrations — keeps alembic_version in sync
    upgrade()
    print('Database reset complete')
