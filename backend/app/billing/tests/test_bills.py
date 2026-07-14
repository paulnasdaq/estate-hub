import uuid
from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.leases.models import Lease, LeaseTerm

BASE = "/api/v1/bills"
BILL_DATE = "2026-08-01"
ITEM_START = "2026-08-01"
ITEM_END = "2026-08-31"


def _lease(db: Session) -> str:
    lease = Lease(
        unit_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        effective_from=datetime(2026, 8, 1),
    )
    db.add(lease)
    db.commit()
    return str(lease.id)


def _term(db: Session, lease_id: str) -> str:
    term = LeaseTerm(
        name="Rent",
        amount=1200,
        interval="monthly",
        rate="fixed",
        type="prepaid",
        lease_id=uuid.UUID(lease_id),
    )
    db.add(term)
    db.commit()
    return str(term.id)


def _create(
    client: TestClient,
    lease_id: str,
    date: str = BILL_DATE,
):
    return client.post(
        BASE,
        json={
            "lease_id": lease_id,
            "date": date,
        },
    )


def test_create_bill(client: TestClient, db_session: Session) -> None:
    lease_id = _lease(db_session)
    resp = _create(client, lease_id)
    assert resp.status_code == 201
    body = resp.json()
    assert body["lease_id"] == lease_id
    assert body["date"] == BILL_DATE
    assert body["id"]
    assert body["created_at"]


def test_create_bill_with_items(client: TestClient, db_session: Session) -> None:
    lease_id = _lease(db_session)
    resp = client.post(
        BASE,
        json={
            "lease_id": lease_id,
            "date": BILL_DATE,
            "items": [
                {
                    "name": "Rent",
                    "amount": 1200,
                    "start_date": ITEM_START,
                    "end_date": ITEM_END,
                },
                {
                    "name": "Water",
                    "amount": 50,
                    "start_date": ITEM_START,
                    "end_date": ITEM_END,
                },
            ],
        },
    )
    assert resp.status_code == 201
    items = resp.json()["items"]
    assert len(items) == 2
    rent = next(i for i in items if i["name"] == "Rent")
    assert rent["amount"] == 1200
    assert rent["start_date"] == ITEM_START
    assert rent["end_date"] == ITEM_END
    assert rent["id"] and rent["created_at"]


def test_create_bill_defaults_to_no_items(
    client: TestClient, db_session: Session
) -> None:
    resp = _create(client, _lease(db_session))
    assert resp.status_code == 201
    assert resp.json()["items"] == []


def test_create_bill_rejects_item_end_before_start(
    client: TestClient, db_session: Session
) -> None:
    resp = client.post(
        BASE,
        json={
            "lease_id": _lease(db_session),
            "date": BILL_DATE,
            "items": [
                {
                    "name": "Rent",
                    "amount": 1200,
                    "start_date": "2026-08-31",
                    "end_date": "2026-08-01",
                }
            ],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


def test_create_bill_item_with_lease_term(
    client: TestClient, db_session: Session
) -> None:
    lease_id = _lease(db_session)
    term_id = _term(db_session, lease_id)
    resp = client.post(
        BASE,
        json={
            "lease_id": lease_id,
            "date": BILL_DATE,
            "items": [
                {
                    "name": "Rent",
                    "amount": 1200,
                    "start_date": ITEM_START,
                    "end_date": ITEM_END,
                    "lease_term_id": term_id,
                }
            ],
        },
    )
    assert resp.status_code == 201
    assert resp.json()["items"][0]["lease_term_id"] == term_id


def test_create_bill_rejects_term_from_another_lease(
    client: TestClient, db_session: Session
) -> None:
    lease_id = _lease(db_session)
    # A term on a *different* lease must not be attachable to this bill's items.
    other_term_id = _term(db_session, _lease(db_session))
    resp = client.post(
        BASE,
        json={
            "lease_id": lease_id,
            "date": BILL_DATE,
            "items": [
                {
                    "name": "Rent",
                    "amount": 1200,
                    "start_date": ITEM_START,
                    "end_date": ITEM_END,
                    "lease_term_id": other_term_id,
                }
            ],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


def test_create_bill_unknown_lease_is_404(client: TestClient) -> None:
    resp = _create(client, str(uuid.uuid4()))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_create_bill_rejects_invalid_date(
    client: TestClient, db_session: Session
) -> None:
    resp = _create(client, _lease(db_session), date="not-a-date")
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


def test_list_and_pagination(client: TestClient, db_session: Session) -> None:
    lease_id = _lease(db_session)
    for _ in range(3):
        assert _create(client, lease_id).status_code == 201

    body = client.get(BASE, params={"limit": 2, "offset": 0}).json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["limit"] == 2

    page2 = client.get(BASE, params={"limit": 2, "offset": 2}).json()
    assert len(page2["items"]) == 1


def test_get_bill(client: TestClient, db_session: Session) -> None:
    bill_id = _create(client, _lease(db_session)).json()["id"]
    resp = client.get(f"{BASE}/{bill_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == bill_id


def test_get_unknown_bill_is_404(client: TestClient) -> None:
    assert client.get(f"{BASE}/{uuid.uuid4()}").status_code == 404


def test_update_bill(client: TestClient, db_session: Session) -> None:
    bill_id = _create(client, _lease(db_session)).json()["id"]
    resp = client.patch(f"{BASE}/{bill_id}", json={"date": "2026-09-15"})
    assert resp.status_code == 200
    assert resp.json()["date"] == "2026-09-15"


def test_update_to_unknown_lease_is_404(
    client: TestClient, db_session: Session
) -> None:
    bill_id = _create(client, _lease(db_session)).json()["id"]
    resp = client.patch(f"{BASE}/{bill_id}", json={"lease_id": str(uuid.uuid4())})
    assert resp.status_code == 404


def test_delete_is_soft_delete(client: TestClient, db_session: Session) -> None:
    bill_id = _create(client, _lease(db_session)).json()["id"]

    assert client.delete(f"{BASE}/{bill_id}").status_code == 204
    # Soft-deleted: 404 on reads and gone from the list.
    assert client.get(f"{BASE}/{bill_id}").status_code == 404
    assert client.get(BASE).json()["total"] == 0
