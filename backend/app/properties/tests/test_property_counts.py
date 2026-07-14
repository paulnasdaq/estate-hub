import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.models import UserAccount

PROPERTIES = "/api/v1/properties"
LEASES = "/api/v1/leases"
EFFECTIVE_FROM = "2026-08-01T00:00:00Z"


def _create_property(client: TestClient, name: str = "Maple Court") -> str:
    resp = client.post(
        PROPERTIES,
        json={
            "name": name,
            "lat": 45.52,
            "lng": -122.68,
            "organization_id": str(uuid.uuid4()),
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def _create_unit(client: TestClient, property_id: str, name: str) -> str:
    resp = client.post(
        f"{PROPERTIES}/{property_id}/units", json={"name": name, "price": 1200}
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def _account(db: Session) -> str:
    account = UserAccount(user_id=uuid.uuid4())
    db.add(account)
    db.commit()
    return str(account.id)


def _lease(client: TestClient, unit_id: str, account_id: str) -> dict:
    resp = client.post(
        LEASES,
        json={
            "unit_id": unit_id,
            "account_id": account_id,
            "effective_from": EFFECTIVE_FROM,
        },
    )
    assert resp.status_code == 201
    return resp.json()


def test_counts_default_to_zero(client: TestClient) -> None:
    body = client.get(f"{PROPERTIES}/{_create_property(client)}").json()
    assert body["unit_count"] == 0
    assert body["occupied_unit_count"] == 0


def test_unit_count_reflects_units(client: TestClient) -> None:
    pid = _create_property(client)
    _create_unit(client, pid, "Unit 1")
    _create_unit(client, pid, "Unit 2")

    body = client.get(f"{PROPERTIES}/{pid}").json()
    assert body["unit_count"] == 2
    # No leases yet, so nothing is occupied.
    assert body["occupied_unit_count"] == 0


def test_occupied_counts_units_with_active_leases(
    client: TestClient, db_session: Session
) -> None:
    pid = _create_property(client)
    unit1 = _create_unit(client, pid, "Unit 1")
    _create_unit(client, pid, "Unit 2")
    _lease(client, unit1, _account(db_session))

    body = client.get(f"{PROPERTIES}/{pid}").json()
    assert body["unit_count"] == 2
    assert body["occupied_unit_count"] == 1


def test_terminated_lease_frees_the_unit(
    client: TestClient, db_session: Session
) -> None:
    pid = _create_property(client)
    unit1 = _create_unit(client, pid, "Unit 1")
    lease_id = _lease(client, unit1, _account(db_session))["id"]

    assert client.get(f"{PROPERTIES}/{pid}").json()["occupied_unit_count"] == 1

    terminated = client.patch(
        f"{LEASES}/{lease_id}", json={"terminated_on": "2026-09-01T00:00:00Z"}
    )
    assert terminated.status_code == 200

    body = client.get(f"{PROPERTIES}/{pid}").json()
    assert body["unit_count"] == 1
    assert body["occupied_unit_count"] == 0


def test_counts_scoped_per_property(client: TestClient, db_session: Session) -> None:
    # A lease on one property's unit must not leak into another's counts.
    pid_a = _create_property(client, "Property A")
    pid_b = _create_property(client, "Property B")
    unit_a = _create_unit(client, pid_a, "A1")
    _create_unit(client, pid_b, "B1")
    _lease(client, unit_a, _account(db_session))

    body_b = client.get(f"{PROPERTIES}/{pid_b}").json()
    assert body_b["unit_count"] == 1
    assert body_b["occupied_unit_count"] == 0


def test_counts_appear_in_list(client: TestClient, db_session: Session) -> None:
    pid = _create_property(client)
    unit1 = _create_unit(client, pid, "Unit 1")
    _create_unit(client, pid, "Unit 2")
    _lease(client, unit1, _account(db_session))

    items = client.get(PROPERTIES).json()["items"]
    prop = next(p for p in items if p["id"] == pid)
    assert prop["unit_count"] == 2
    assert prop["occupied_unit_count"] == 1
