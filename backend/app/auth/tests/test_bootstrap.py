import pytest
from sqlalchemy.orm import Session

from app.auth.security import verify_password
from app.organizations.models import Organization
from app.scripts.create_user import create_user


def test_create_user_makes_a_login_ready_user(db_session: Session) -> None:
    user = create_user(
        db_session,
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        password="bootstrap-secret",
    )

    assert user.id is not None
    # Password is set (activated) and verifies.
    assert user.password_hash is not None
    assert verify_password("bootstrap-secret", user.password_hash)
    # Every user gets an account; without --org-name it belongs to no org.
    assert len(user.accounts) == 1
    assert user.accounts[0].organization_id is None


def test_create_user_with_org_creates_membership(db_session: Session) -> None:
    user = create_user(
        db_session,
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        password="bootstrap-secret",
        org_name="Acme Properties",
    )

    org = db_session.query(Organization).one()
    assert org.name == "Acme Properties"
    assert user.accounts[0].organization_id == org.id


def test_create_user_rejects_duplicate_email(db_session: Session) -> None:
    create_user(
        db_session,
        first_name="Ada",
        last_name="Lovelace",
        email="ada@example.com",
        password="bootstrap-secret",
    )

    with pytest.raises(ValueError, match="already exists"):
        create_user(
            db_session,
            first_name="Grace",
            last_name="Hopper",
            email="ada@example.com",
            password="another-secret",
        )
