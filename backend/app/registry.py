"""Imports every feature's models so they register on Base.metadata.

Alembic's autogenerate and any create_all rely on all models being imported.
Add each new feature's models module here.

Any process that touches the ORM must import this module during startup, so
that string-based relationships (e.g. ``UserAccount.organization``) can resolve
their target classes when mappers are configured. The FastAPI app does this in
``app.main`` and the Celery worker in ``app.core.celery_app``; a new entrypoint
that runs queries must do the same or the first ORM call will raise an
``InvalidRequestError`` about a name it "failed to locate".
"""

from app.auth import models as auth_models  # noqa: F401
from app.billing import models as billing_models  # noqa: F401
from app.leases import models as leases_models  # noqa: F401
from app.organizations import models as organizations_models  # noqa: F401
from app.payments import models as payments_models  # noqa: F401
from app.properties import models as properties_models  # noqa: F401
from app.shared import models as shared_models  # noqa: F401
