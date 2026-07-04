"""Imports every feature's models so they register on Base.metadata.

Alembic's autogenerate and any create_all rely on all models being imported.
Add each new feature's models module here.
"""

from app.organizations import models as organizations_models  # noqa: F401
