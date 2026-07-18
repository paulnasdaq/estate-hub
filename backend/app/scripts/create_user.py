"""Create a user directly — for bootstrapping the first admin.

Product routes (including ``POST /users``) require authentication, so a fresh
deployment has a chicken-and-egg problem: nobody can create the first user over
the API. Run this out-of-band instead. It creates an *activated* user (password
already set, so they can sign in immediately) and, with ``--org-name``, an
organization plus a membership account.

    uv run python -m app.scripts.create_user \
        --first-name Ada --last-name Lovelace \
        --email ada@example.com --password 'change-me-please' \
        --org-name "Acme Properties"
"""

from __future__ import annotations

import argparse
import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import User, UserAccount
from app.auth.security import hash_password
from app.core.database import session_scope
from app.organizations.models import Organization


def create_user(
    db: Session,
    *,
    first_name: str,
    last_name: str,
    email: str,
    password: str,
    org_name: str | None = None,
) -> User:
    """Create an activated user (and optionally an organization), returning it.

    Raises ``ValueError`` if the email is already taken.
    """
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise ValueError(f"A user with email {email} already exists")

    user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password_hash=hash_password(password),
    )
    if org_name:
        org = Organization(name=org_name)
        db.add(org)
        db.flush()
        user.accounts.append(UserAccount(organization_id=org.id))
    else:
        # Every user has an account; here it belongs to no organization yet.
        user.accounts.append(UserAccount())

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Create a user directly (bootstrap the first admin)."
    )
    parser.add_argument("--first-name", required=True)
    parser.add_argument("--last-name", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument(
        "--org-name",
        default=None,
        help="Create this organization and add the user to it.",
    )
    args = parser.parse_args(argv)

    with session_scope() as db:
        try:
            user = create_user(
                db,
                first_name=args.first_name,
                last_name=args.last_name,
                email=args.email,
                password=args.password,
                org_name=args.org_name,
            )
        except ValueError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1
        user_id, user_email = user.id, user.email

    print(f"Created user {user_email} (id={user_id})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
