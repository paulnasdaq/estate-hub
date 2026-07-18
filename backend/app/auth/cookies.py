"""Set/clear the refresh-token cookie consistently across the auth routes.

The cookie is HttpOnly (invisible to JS, so an XSS bug can't read the refresh
token) and scoped by ``Path`` to the auth endpoints (it's only ever needed by
/refresh and /logout). Its ``SameSite`` policy is configurable
(``refresh_cookie_samesite``): "strict" for a same-origin deployment, "none" for
a cross-origin one. It is marked ``Secure`` in production — and always when
SameSite is "none", which browsers require — so it still works over plain http on
localhost in same-origin development.
"""

from fastapi import Response

from app.core.config import settings

# The cookie is only sent to the auth endpoints that consume it.
COOKIE_PATH = "/api/v1/auth"
_MAX_AGE_SECONDS = settings.refresh_token_ttl_days * 24 * 60 * 60


def _secure() -> bool:
    # SameSite=None cookies are only honoured when Secure, so force it there even
    # outside production (a cross-origin dev setup must use https).
    return settings.is_production or settings.refresh_cookie_samesite == "none"


def set_refresh_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=raw_token,
        max_age=_MAX_AGE_SECONDS,
        httponly=True,
        secure=_secure(),
        samesite=settings.refresh_cookie_samesite,
        path=COOKIE_PATH,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        path=COOKIE_PATH,
        httponly=True,
        secure=_secure(),
        samesite=settings.refresh_cookie_samesite,
    )
