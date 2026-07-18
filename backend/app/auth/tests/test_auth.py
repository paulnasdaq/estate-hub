import uuid
from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth import tasks
from app.auth.models import User
from app.auth.security import (
    create_access_token,
    create_activation_token,
    hash_password,
)

USERS = "/api/v1/users"
ORGS = "/api/v1/organizations"
LOGIN = "/api/v1/auth/login"
ACTIVATE = "/api/v1/auth/activate"
ME = "/api/v1/auth/me"

EMAIL = "ada@example.com"
PASSWORD = "correct horse battery"


def _seed_user(db: Session, *, email: str = EMAIL, activated: bool = False) -> User:
    """Insert a user directly, optionally already having a password set.

    Seeding via the session (rather than the now-protected POST /users) keeps the
    auth tests independent of route protection.
    """
    user = User(
        first_name="Ada",
        last_name="Lovelace",
        email=email,
        password_hash=hash_password(PASSWORD) if activated else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# --- route protection --------------------------------------------------------


def test_protected_route_requires_auth(anon_client: TestClient) -> None:
    resp = anon_client.get(ORGS)
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


def test_protected_route_allows_authenticated(client: TestClient) -> None:
    assert client.get(ORGS).status_code == 200


def test_user_read_does_not_expose_password(
    client: TestClient, db_session: Session
) -> None:
    user = _seed_user(db_session, activated=True)
    body = client.get(f"{USERS}/{user.id}").json()
    assert "password" not in body
    assert "password_hash" not in body


# --- creation leaves the account un-activated -------------------------------


def test_new_user_cannot_log_in_before_activation(
    anon_client: TestClient, db_session: Session
) -> None:
    _seed_user(db_session)  # no password set
    resp = anon_client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "invalid_credentials"


# --- activation --------------------------------------------------------------


def test_activate_sets_password_and_returns_token(
    anon_client: TestClient, db_session: Session
) -> None:
    user = _seed_user(db_session)
    token = create_activation_token(user.id)

    resp = anon_client.post(ACTIVATE, json={"token": token, "password": PASSWORD})

    assert resp.status_code == 200
    access_token = resp.json()["access_token"]
    assert resp.json()["token_type"] == "bearer"
    # The returned token authenticates the user immediately.
    me = anon_client.get(ME, headers={"Authorization": f"Bearer {access_token}"})
    assert me.status_code == 200
    assert me.json()["email"] == EMAIL


def test_login_works_after_activation(
    anon_client: TestClient, db_session: Session
) -> None:
    user = _seed_user(db_session)
    token = create_activation_token(user.id)
    anon_client.post(ACTIVATE, json={"token": token, "password": PASSWORD})

    resp = anon_client.post(LOGIN, json={"email": EMAIL, "password": PASSWORD})

    assert resp.status_code == 200
    assert resp.json()["access_token"]


def test_activate_with_garbage_token_is_400(anon_client: TestClient) -> None:
    resp = anon_client.post(
        ACTIVATE, json={"token": "not-a-jwt", "password": PASSWORD}
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_activation_token"


def test_login_token_is_not_accepted_as_activation(
    anon_client: TestClient, db_session: Session
) -> None:
    user = _seed_user(db_session)
    # A wrong-purpose token (login) must not activate the account.
    wrong = create_access_token(user.id)
    resp = anon_client.post(ACTIVATE, json={"token": wrong, "password": PASSWORD})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_activation_token"


def test_activate_unknown_user_is_400(anon_client: TestClient) -> None:
    token = create_activation_token(uuid.uuid4())
    resp = anon_client.post(ACTIVATE, json={"token": token, "password": PASSWORD})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_activation_token"


def test_activate_twice_conflicts(
    anon_client: TestClient, db_session: Session
) -> None:
    user = _seed_user(db_session)
    token = create_activation_token(user.id)
    assert (
        anon_client.post(
            ACTIVATE, json={"token": token, "password": PASSWORD}
        ).status_code
        == 200
    )

    again = anon_client.post(
        ACTIVATE, json={"token": token, "password": "a-different-password"}
    )
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "account_already_activated"


def test_activate_short_password_is_422(
    anon_client: TestClient, db_session: Session
) -> None:
    user = _seed_user(db_session)
    token = create_activation_token(user.id)
    resp = anon_client.post(ACTIVATE, json={"token": token, "password": "short"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


# --- login / me edge cases ---------------------------------------------------


def test_login_wrong_password_is_401(
    anon_client: TestClient, db_session: Session
) -> None:
    _seed_user(db_session, activated=True)
    resp = anon_client.post(LOGIN, json={"email": EMAIL, "password": "not-it"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "invalid_credentials"


def test_login_unknown_email_is_401(anon_client: TestClient) -> None:
    resp = anon_client.post(
        LOGIN, json={"email": "nobody@example.com", "password": "x"}
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "invalid_credentials"


def test_me_without_token_is_401(anon_client: TestClient) -> None:
    resp = anon_client.get(ME)
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


def test_me_with_garbage_token_is_401(anon_client: TestClient) -> None:
    resp = anon_client.get(ME, headers={"Authorization": "Bearer not-a-jwt"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "not_authenticated"


# --- activation email task ---------------------------------------------------


def test_send_activation_email_sends_link(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = _seed_user(db_session)

    @contextmanager
    def fake_scope():  # noqa: ANN202
        yield db_session

    sent: dict = {}

    def fake_send_email(*, to: str, subject: str, text: str, html: str) -> bool:
        sent.update(to=to, subject=subject, text=text, html=html)
        return True

    monkeypatch.setattr(tasks, "session_scope", fake_scope)
    monkeypatch.setattr(tasks, "send_email", fake_send_email)

    assert tasks.send_activation_email(str(user.id)) is True
    assert sent["to"] == EMAIL
    assert "/activate?token=" in sent["text"]
    assert "/activate?token=" in sent["html"]


def test_send_activation_email_skips_already_activated(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    user = _seed_user(db_session, activated=True)

    @contextmanager
    def fake_scope():  # noqa: ANN202
        yield db_session

    called = False

    def fake_send_email(**kwargs: object) -> bool:
        nonlocal called
        called = True
        return True

    monkeypatch.setattr(tasks, "session_scope", fake_scope)
    monkeypatch.setattr(tasks, "send_email", fake_send_email)

    assert tasks.send_activation_email(str(user.id)) is False
    assert called is False
