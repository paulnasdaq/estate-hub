"""Tests for receipt rendering and the bill notification pipeline."""

import uuid
from contextlib import contextmanager
from datetime import UTC, date, datetime

import pytest
from sqlalchemy.orm import Session

from app.auth.models.user import User
from app.auth.models.user_account import UserAccount
from app.billing import receipts, tasks
from app.billing.models import Bill, BillItem
from app.core.email import Attachment
from app.leases.models import Lease
from app.organizations.models import Organization
from app.properties.models import Property, Unit


def _bill_with_graph(db: Session) -> Bill:
    """Build a full org -> user/account -> property/unit -> lease -> bill graph."""
    org = Organization(name="Sunrise Properties")
    user = User(first_name="Jane", last_name="Mwangi", email="jane@example.com")
    db.add_all([org, user])
    db.commit()

    account = UserAccount(user_id=user.id, organization_id=org.id)
    prop = Property(name="Sunrise Court", lng=36.8, lat=-1.29, organization_id=org.id)
    db.add_all([account, prop])
    db.commit()

    unit = Unit(name="B4", price=25000, property_id=prop.id)
    db.add(unit)
    db.commit()

    lease = Lease(
        unit_id=unit.id,
        account_id=account.id,
        effective_from=datetime(2026, 6, 1, tzinfo=UTC),
    )
    db.add(lease)
    db.commit()

    bill = Bill(
        lease_id=lease.id,
        date=date(2026, 7, 1),
        items=[
            BillItem(
                name="Rent",
                amount=25000,
                start_date=date(2026, 7, 1),
                end_date=date(2026, 8, 1),
            ),
            BillItem(
                name="Water",
                amount=1500,
                start_date=date(2026, 7, 1),
                end_date=date(2026, 8, 1),
            ),
        ],
    )
    db.add(bill)
    db.commit()
    return bill


def test_build_bill_context_maps_model(db_session: Session) -> None:
    bill = _bill_with_graph(db_session)

    ctx = receipts.build_bill_context(db_session, bill)

    assert ctx["organization"]["name"] == "Sunrise Properties"
    assert ctx["customer"]["name"] == "Jane Mwangi"
    assert "Unit B4 · Sunrise Court" in ctx["customer"]["address_lines"]
    assert "jane@example.com" in ctx["customer"]["address_lines"]
    assert ctx["invoice"]["number"].startswith("INV-")
    assert ctx["invoice"]["issued_date"] == "Jul 01, 2026"
    # Items sorted, amounts summed.
    assert [i["description"] for i in ctx["items"]] == ["Rent", "Water"]
    assert ctx["subtotal"] == ctx["total"] == 26500
    assert ctx["currency"] == "KES"


def test_build_context_falls_back_without_organization(db_session: Session) -> None:
    bill = _bill_with_graph(db_session)
    # Point the lease's account at one with no organization.
    account = UserAccount(user_id=db_session.query(User).one().id, organization_id=None)
    db_session.add(account)
    db_session.commit()
    bill.lease.account_id = account.id
    db_session.commit()

    ctx = receipts.build_bill_context(db_session, bill)
    assert ctx["organization"]["name"] == "Housing"  # receipt_company_name default


def test_render_bill_pdf_produces_pdf(db_session: Session) -> None:
    bill = _bill_with_graph(db_session)
    pdf = receipts.render_bill_pdf(db_session, bill)
    assert pdf[:4] == b"%PDF"


def test_generate_bill_receipt_uploads_pdf(
    db_session: Session, s3_stub, monkeypatch: pytest.MonkeyPatch
) -> None:
    bill = _bill_with_graph(db_session)

    @contextmanager
    def fake_scope():  # noqa: ANN202
        yield db_session

    monkeypatch.setattr(tasks, "session_scope", fake_scope)
    monkeypatch.setattr(tasks, "get_s3_client", lambda: s3_stub)

    key = tasks.generate_bill_receipt(str(bill.id))

    assert key == f"receipts/{bill.id}.pdf"
    assert s3_stub.objects[key][:4] == b"%PDF"


def test_generate_bill_receipt_skips_missing_bill(
    db_session: Session, s3_stub, monkeypatch: pytest.MonkeyPatch
) -> None:
    @contextmanager
    def fake_scope():  # noqa: ANN202
        yield db_session

    monkeypatch.setattr(tasks, "session_scope", fake_scope)
    monkeypatch.setattr(tasks, "get_s3_client", lambda: s3_stub)

    assert tasks.generate_bill_receipt(str(uuid.uuid4())) is None
    assert s3_stub.objects == {}


def test_notify_tenant_sends_email_with_receipt(
    db_session: Session, s3_stub, monkeypatch: pytest.MonkeyPatch
) -> None:
    bill = _bill_with_graph(db_session)
    key = f"receipts/{bill.id}.pdf"
    s3_stub.objects[key] = b"%PDF-1.7 fake"

    @contextmanager
    def fake_scope():  # noqa: ANN202
        yield db_session

    sent: dict = {}

    def fake_send_email(
        *, to: str, subject: str, text: str, attachments: list[Attachment] | None = None
    ) -> bool:
        sent.update(to=to, subject=subject, text=text, attachments=attachments)
        return True

    monkeypatch.setattr(tasks, "session_scope", fake_scope)
    monkeypatch.setattr(tasks, "get_s3_client", lambda: s3_stub)
    monkeypatch.setattr(tasks, "send_email", fake_send_email)

    assert tasks.notify_tenant_of_bill(str(bill.id)) is True
    assert sent["to"] == "jane@example.com"
    assert "26,500" in sent["text"]
    # The rendered receipt is attached as a PDF.
    assert sent["attachments"][0][0] == f"receipt-{bill.id}.pdf"
    assert sent["attachments"][0][1] == b"%PDF-1.7 fake"


def test_notify_tenant_without_email_is_skipped(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Lease account id points at nothing -> no user/email resolvable.
    lease = Lease(
        unit_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        effective_from=datetime(2026, 6, 1, tzinfo=UTC),
    )
    db_session.add(lease)
    db_session.commit()
    bill = Bill(lease_id=lease.id, date=date(2026, 7, 1))
    db_session.add(bill)
    db_session.commit()

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

    assert tasks.notify_tenant_of_bill(str(bill.id)) is False
    assert called is False
