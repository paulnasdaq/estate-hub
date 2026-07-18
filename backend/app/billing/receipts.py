"""Render a bill to an invoice/receipt (HTML and PDF).

The Jinja template in ``templates/bill.html.jinja`` is presentation-only; this
module owns the mapping from the ORM graph (``Bill`` -> lease -> account ->
user/organization, plus the unit/property) onto the shape the template expects.
Keeping that mapping here means the template never touches the database and the
context is trivial to unit-test.

Amounts are stored as whole integers, so ``subtotal``/``total`` are plain sums
and the currency is only a display prefix (see ``settings.receipt_currency``).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape
from sqlalchemy.orm import Session

from app.auth.models.user_account import UserAccount
from app.billing.models.bill import Bill
from app.core.config import settings
from app.properties.models.property import Property
from app.properties.models.unit import Unit

_TEMPLATE_DIR = Path(__file__).parent / "templates"
_TEMPLATE_NAME = "bill.html.jinja"


@lru_cache(maxsize=1)
def _environment() -> Environment:
    """Process-wide Jinja environment (cached; loaders are cheap to share)."""
    return Environment(
        loader=FileSystemLoader(_TEMPLATE_DIR),
        autoescape=select_autoescape(["html", "xml", "jinja"]),
    )


def _fmt_period(bill_item: Any) -> str:
    """A human service-period string, e.g. "Jan 01 – Feb 01, 2026"."""
    start, end = bill_item.start_date, bill_item.end_date
    if start.year == end.year:
        return f"{start:%b %d} – {end:%b %d, %Y}"
    return f"{start:%b %d, %Y} – {end:%b %d, %Y}"


def build_bill_context(db: Session, bill: Bill) -> dict[str, Any]:
    """Map a persisted ``Bill`` onto the invoice template context.

    Traverses lease -> account (user + organization) and unit -> property to
    fill the "from" and "billed to" blocks. Missing links degrade gracefully:
    an account without an organization falls back to ``receipt_company_name``.
    """
    lease = bill.lease
    account = db.get(UserAccount, lease.account_id)
    user = account.user if account else None
    organization = account.organization if account else None

    unit = db.get(Unit, lease.unit_id)
    property_ = db.get(Property, unit.property_id) if unit else None

    customer_lines: list[str] = []
    if unit is not None:
        location = f"Unit {unit.name}"
        if property_ is not None:
            location = f"{location} · {property_.name}"
        customer_lines.append(location)
    if user is not None and user.email:
        customer_lines.append(user.email)

    items = [
        {
            "description": item.name,
            "period": _fmt_period(item),
            "amount": item.amount,
        }
        for item in sorted(bill.items, key=lambda i: (i.start_date, i.name))
    ]
    total = sum(item.amount for item in bill.items)

    org_name = organization.name if organization else settings.receipt_company_name
    return {
        "organization": {
            "name": org_name,
            "logo_url": None,
            "email": None,
            "address_lines": [],
        },
        "customer": {
            "name": user.name if user else "Tenant",
            "address_lines": customer_lines,
        },
        "invoice": {
            # No sequential invoice number is stored; derive a stable, readable
            # reference from the bill id.
            "number": f"INV-{str(bill.id).split('-')[0].upper()}",
            "issued_date": f"{bill.date:%b %d, %Y}",
            "due_date": None,
        },
        "items": items,
        "currency": settings.receipt_currency,
        "subtotal": total,
        "total": total,
        "payment_terms": None,
        "notes": None,
    }


def render_bill_html(db: Session, bill: Bill) -> str:
    """Render the bill to a standalone HTML string."""
    context = build_bill_context(db, bill)
    return _environment().get_template(_TEMPLATE_NAME).render(**context)


def render_bill_pdf(db: Session, bill: Bill) -> bytes:
    """Render the bill to PDF bytes via WeasyPrint."""
    # Imported lazily: WeasyPrint pulls in native libraries (pango/cairo) and is
    # only needed by the receipt-generation task, not on every app import.
    from weasyprint import HTML

    html = render_bill_html(db, bill)
    return HTML(string=html).write_pdf()
