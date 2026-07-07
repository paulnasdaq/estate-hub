import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.auth.models import UserAccount
from app.properties.models import Unit

BASE = "/api/v1/leases"
EFFECTIVE_FROM = "2026-08-01T00:00:00Z"


def _unit(db: Session, name: str = "Apt 1") -> str:
    unit = Unit(name=name, property_id=uuid.uuid4())
    db.add(unit)
    db.commit()
    return str(unit.id)


def _account(db: Session) -> str:
    account = UserAccount(user_id=uuid.uuid4())
    db.add(account)
    db.commit()
    return str(account.id)


def _create(
    client: TestClient,
    unit_id: str,
    account_id: str,
    terminated_on: str | None = None,
):
    body = {
        "unit_id": unit_id,
        "account_id": account_id,
        "effective_from": EFFECTIVE_FROM,
    }
    if terminated_on is not None:
        body["terminated_on"] = terminated_on
    return client.post(BASE, json=body)


def test_create_lease(client: TestClient, db_session: Session) -> None:
    uid, aid = _unit(db_session), _account(db_session)
    resp = _create(client, uid, aid)
    assert resp.status_code == 201
    body = resp.json()
    assert body["unit_id"] == uid
    assert body["account_id"] == aid
    assert body["terminated_on"] is None
    assert body["id"]
    assert body["created_at"]


def test_create_lease_unknown_unit_is_404(
    client: TestClient, db_session: Session
) -> None:
    resp = _create(client, str(uuid.uuid4()), _account(db_session))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_create_lease_unknown_account_is_404(
    client: TestClient, db_session: Session
) -> None:
    resp = _create(client, _unit(db_session), str(uuid.uuid4()))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_second_active_lease_on_unit_conflicts(
    client: TestClient, db_session: Session
) -> None:
    uid = _unit(db_session)
    assert _create(client, uid, _account(db_session)).status_code == 201

    resp = _create(client, uid, _account(db_session))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "conflict"


def test_new_lease_allowed_after_previous_terminated(
    client: TestClient, db_session: Session
) -> None:
    uid = _unit(db_session)
    lease_id = _create(client, uid, _account(db_session)).json()["id"]

    terminated = client.patch(
        f"{BASE}/{lease_id}", json={"terminated_on": "2026-09-01T00:00:00Z"}
    )
    assert terminated.status_code == 200
    assert terminated.json()["terminated_on"] is not None

    # The unit is free again once the prior lease is terminated.
    assert _create(client, uid, _account(db_session)).status_code == 201


def test_list_and_pagination(client: TestClient, db_session: Session) -> None:
    aid = _account(db_session)
    for i in range(3):
        assert _create(client, _unit(db_session, f"Unit {i}"), aid).status_code == 201

    body = client.get(BASE, params={"limit": 2, "offset": 0}).json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["limit"] == 2

    page2 = client.get(BASE, params={"limit": 2, "offset": 2}).json()
    assert len(page2["items"]) == 1


def test_get_lease(client: TestClient, db_session: Session) -> None:
    lease_id = _create(client, _unit(db_session), _account(db_session)).json()["id"]
    resp = client.get(f"{BASE}/{lease_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == lease_id


def test_get_unknown_lease_is_404(client: TestClient) -> None:
    assert client.get(f"{BASE}/{uuid.uuid4()}").status_code == 404


def test_update_to_unknown_unit_is_404(client: TestClient, db_session: Session) -> None:
    lease_id = _create(client, _unit(db_session), _account(db_session)).json()["id"]
    resp = client.patch(f"{BASE}/{lease_id}", json={"unit_id": str(uuid.uuid4())})
    assert resp.status_code == 404


def test_delete_is_soft_delete(client: TestClient, db_session: Session) -> None:
    lease_id = _create(client, _unit(db_session), _account(db_session)).json()["id"]

    assert client.delete(f"{BASE}/{lease_id}").status_code == 204
    # Soft-deleted: 404 on reads and gone from the list.
    assert client.get(f"{BASE}/{lease_id}").status_code == 404
    assert client.get(BASE).json()["total"] == 0


def test_delete_frees_unit_for_a_new_lease(
    client: TestClient, db_session: Session
) -> None:
    uid = _unit(db_session)
    lease_id = _create(client, uid, _account(db_session)).json()["id"]

    assert client.delete(f"{BASE}/{lease_id}").status_code == 204
    # Deleting the active lease releases the unit.
    assert _create(client, uid, _account(db_session)).status_code == 201
