import uuid
from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import tasks
from app.auth.exceptions import InvalidResetTokenError
from app.auth.models import User
from app.auth.security import (
    create_access_token,
    create_reset_token,
    hash_password,
)
from app.auth.services import UserService

FORGOT = "/api/v1/auth/forgot-password"
RESET = "/api/v1/auth/reset-password"
LOGIN = "/api/v1/auth/login"
REFRESH = "/api/v1/auth/refresh"
COOKIE = "refresh_token"

EMAIL = "ada@example.com"
OLD_PASSWORD = "old horse battery"
NEW_PASSWORD = "brand new password"


def _seed_active_user(db: Session, *, activated: bool = True) -> User:
    user = User(
        first_name="Ada",
        last_name="Lovelace",
        email=EMAIL,
        password_hash=hash_password(OLD_PASSWORD) if activated else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# --- service ----------------------------------------------------------------


def test_request_reset_returns_active_user(db_session: Session) -> None:
    user = _seed_active_user(db_session)
    assert UserService(db_session).request_password_reset(EMAIL).id == user.id


def test_request_reset_unknown_email_returns_none(db_session: Session) -> None:
    assert UserService(db_session).request_password_reset("nobody@x.com") is None


def test_request_reset_unactivated_returns_none(db_session: Session) -> None:
    _seed_active_user(db_session, activated=False)
    assert UserService(db_session).request_password_reset(EMAIL) is None


def test_reset_password_sets_new_hash(db_session: Session) -> None:
    user = _seed_active_user(db_session)
    token = create_reset_token(user.id)

    UserService(db_session).reset_password(token, NEW_PASSWORD)

    # The new password authenticates; the old one no longer does.
    assert UserService(db_session).authenticate(EMAIL, NEW_PASSWORD).id == user.id


def test_reset_password_rejects_garbage_token(db_session: Session) -> None:
    with pytest.raises(InvalidResetTokenError):
        UserService(db_session).reset_password("not-a-jwt", NEW_PASSWORD)


def test_reset_password_rejects_wrong_token_type(db_session: Session) -> None:
    user = _seed_active_user(db_session)
    wrong = create_access_token(user.id)  # a login token, not a reset token
    with pytest.raises(InvalidResetTokenError):
        UserService(db_session).reset_password(wrong, NEW_PASSWORD)


# --- routes -----------------------------------------------------------------


def test_forgot_password_is_204_for_known_email(
    anon_client: TestClient, db_session: Session
) -> None:
    _seed_active_user(db_session)
    assert anon_client.post(FORGOT, json={"email": EMAIL}).status_code == 204


def test_forgot_password_is_204_for_unknown_email(anon_client: TestClient) -> None:
    # Identical response to a known email — never reveals who is registered.
    assert (
        anon_client.post(FORGOT, json={"email": "nobody@x.com"}).status_code == 204
    )


def test_reset_password_signs_in_and_lets_new_password_log_in(
    anon_client: TestClient, db_session: Session
) -> None:
    user = _seed_active_user(db_session)
    token = create_reset_token(user.id)

    resp = anon_client.post(RESET, json={"token": token, "password": NEW_PASSWORD})

    assert resp.status_code == 200
    assert resp.json()["access_token"]
    assert anon_client.cookies.get(COOKIE)  # a fresh session was issued
    # The new password now works at login.
    assert (
        anon_client.post(
            LOGIN, json={"email": EMAIL, "password": NEW_PASSWORD}
        ).status_code
        == 200
    )


def test_reset_password_garbage_token_is_400(anon_client: TestClient) -> None:
    resp = anon_client.post(RESET, json={"token": "nope", "password": NEW_PASSWORD})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_reset_token"


def test_reset_password_revokes_existing_sessions(
    anon_client: TestClient, db_session: Session
) -> None:
    user = _seed_active_user(db_session)
    anon_client.post(LOGIN, json={"email": EMAIL, "password": OLD_PASSWORD})
    old_cookie = anon_client.cookies.get(COOKIE)

    token = create_reset_token(user.id)
    assert (
        anon_client.post(
            RESET, json={"token": token, "password": NEW_PASSWORD}
        ).status_code
        == 200
    )

    # The session that existed before the reset is now dead.
    assert anon_client.post(REFRESH, cookies={COOKIE: old_cookie}).status_code == 401


def test_reset_short_password_is_422(
    anon_client: TestClient, db_session: Session
) -> None:
    user = _seed_active_user(db_session)
    token = create_reset_token(user.id)
    resp = anon_client.post(RESET, json={"token": token, "password": "short"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


# --- reset email task -------------------------------------------------------


def test_send_password_reset_email_sends_link(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = _seed_active_user(db_session)

    @contextmanager
    def fake_scope():  # noqa: ANN202
        yield db_session

    sent: dict = {}

    def fake_send_email(*, to: str, subject: str, text: str, html: str) -> bool:
        sent.update(to=to, text=text, html=html)
        return True

    monkeypatch.setattr(tasks, "session_scope", fake_scope)
    monkeypatch.setattr(tasks, "send_email", fake_send_email)

    assert tasks.send_password_reset_email(str(user.id)) is True
    assert sent["to"] == EMAIL
    assert "/reset-password?token=" in sent["text"]
    assert "/reset-password?token=" in sent["html"]


def test_send_password_reset_email_skips_missing_user(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    @contextmanager
    def fake_scope():  # noqa: ANN202
        yield db_session

    monkeypatch.setattr(tasks, "session_scope", fake_scope)

    assert tasks.send_password_reset_email(str(uuid.uuid4())) is False
