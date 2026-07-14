"""Imports every feature's models so they register on Base.metadata.

Alembic's autogenerate and any create_all rely on all models being imported.
Add each new feature's models module here.
"""

from app.auth import models as auth_models  # noqa: F401
from app.billing import models as billing_models  # noqa: F401
from app.leases import models as leases_models  # noqa: F401
from app.organizations import models as organizations_models  # noqa: F401
from app.properties import models as properties_models  # noqa: F401
from app.shared import models as shared_models  # noqa: F401
