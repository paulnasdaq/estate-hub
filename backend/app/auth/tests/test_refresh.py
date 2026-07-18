from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.exceptions import InvalidRefreshTokenError
from app.auth.models import RefreshToken, User
from app.auth.security import hash_refresh_token
from app.auth.services import RefreshTokenService
from app.core.database import utcnow

LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"
ME = "/api/v1/auth/me"
COOKIE = "refresh_token"

EMAIL = "ada@example.com"
PASSWORD = "correct horse battery"


def _seed_active_user(db: Session) -> User:
    from app.auth.security import hash_password

    user = User(
        first_name="Ada",
        last_name="Lovelace",
        email=EMAIL,
        password_hash=hash_password(PASSWORD),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _record(db: Session, raw: str) -> RefreshToken | None:
    return db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == hash_refresh_token(raw)
        )
    )


# --- service ----------------------------------------------------------------


def test_rotate_supersedes_old_token(db_session: Session) -> None:
    user = _seed_active_user(db_session)
    service = RefreshTokenService(db_session)
    raw = service.issue(user.id)

    rotated_user, new_raw = service.rotate(raw)

    assert rotated_user.id == user.id
    assert new_raw != raw
    # Old token is revoked; new token is live.
    assert _record(db_session, raw).revoked_at is not None
    assert _record(db_session, new_raw).revoked_at is None


def test_rotate_unknown_token_raises(db_session: Session) -> None:
    with pytest.raises(InvalidRefreshTokenError):
        RefreshTokenService(db_session).rotate("nope")


def test_rotate_expired_token_raises(db_session: Session) -> None:
    user = _seed_active_user(db_session)
    service = RefreshTokenService(db_session)
    raw = service.issue(user.id)
    record = _record(db_session, raw)
    record.expires_at = utcnow() - timedelta(seconds=1)
    db_session.commit()

    with pytest.raises(InvalidRefreshTokenError):
        service.rotate(raw)


def test_reuse_of_rotated_token_revokes_family(db_session: Session) -> None:
    user = _seed_active_user(db_session)
    service = RefreshTokenService(db_session)
    raw = service.issue(user.id)
    _, new_raw = service.rotate(raw)

    # Replaying the superseded token is treated as theft.
    with pytest.raises(InvalidRefreshTokenError):
        service.rotate(raw)

    # ...and it takes the still-live descendant down with it.
    db_session.expire_all()
    assert _record(db_session, new_raw).revoked_at is not None
    with pytest.raises(InvalidRefreshTokenError):
        service.rotate(new_raw)


def test_revoke_kills_the_session(db_session: Session) -> None:
    user = _seed_active_user(db_session)
    service = RefreshTokenService(db_session)
    raw = service.issue(user.id)

    service.revoke(raw)

    assert _record(db_session, raw).revoked_at is not None
    with pytest.raises(InvalidRefreshTokenError):
        service.rotate(raw)


# --- routes -----------------------------------------------------------------


def test_login_sets_refresh_cookie(
    anon_client: TestClient, db_session: Session
) -> None:
    _seed_active_user(db_session)
    resp = anon_client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})
    assert resp.status_code == 200
    assert anon_client.cookies.get(COOKIE)


def test_refresh_returns_new_access_token_and_rotates_cookie(
    anon_client: TestClient, db_session: Session
) -> None:
    _seed_active_user(db_session)
    anon_client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})
    old_cookie = anon_client.cookies.get(COOKIE)

    resp = anon_client.post(REFRESH)

    assert resp.status_code == 200
    assert resp.json()["access_token"]
    # The cookie is rotated to a fresh value.
    assert anon_client.cookies.get(COOKIE) != old_cookie


def test_refresh_without_cookie_is_401(anon_client: TestClient) -> None:
    resp = anon_client.post(REFRESH)
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "invalid_refresh_token"


def test_logout_revokes_session(
    anon_client: TestClient, db_session: Session
) -> None:
    _seed_active_user(db_session)
    anon_client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})

    assert anon_client.post(LOGOUT).status_code == 204
    # The refresh cookie no longer works.
    assert anon_client.post(REFRESH).status_code == 401


def test_refresh_reuse_detection_over_http(
    anon_client: TestClient, db_session: Session
) -> None:
    _seed_active_user(db_session)
    anon_client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})
    old_cookie = anon_client.cookies.get(COOKIE)

    assert anon_client.post(REFRESH).status_code == 200
    new_cookie = anon_client.cookies.get(COOKIE)

    # Replaying the old cookie is rejected and revokes the whole family.
    assert anon_client.post(REFRESH, cookies={COOKIE: old_cookie}).status_code == 401
    assert anon_client.post(REFRESH, cookies={COOKIE: new_cookie}).status_code == 401
