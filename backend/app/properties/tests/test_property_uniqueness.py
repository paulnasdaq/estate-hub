import uuid

from fastapi.testclient import TestClient

PROPERTIES = "/api/v1/properties"


def _create_property(
    client: TestClient,
    name: str = "Maple Court",
    organization_id: str | None = None,
) -> "tuple[int, dict]":
    resp = client.post(
        PROPERTIES,
        json={
            "name": name,
            "lat": 45.52,
            "lng": -122.68,
            "organization_id": organization_id or str(uuid.uuid4()),
        },
    )
    return resp.status_code, resp.json()


def test_duplicate_property_name_in_same_org_conflicts(client: TestClient) -> None:
    org = str(uuid.uuid4())
    status_code, _ = _create_property(client, "Maple Court", organization_id=org)
    assert status_code == 201

    status_code, body = _create_property(client, "Maple Court", organization_id=org)
    assert status_code == 409
    assert body["error"]["code"] == "conflict"


def test_same_property_name_in_different_orgs_is_allowed(client: TestClient) -> None:
    status_a, _ = _create_property(
        client, "Maple Court", organization_id=str(uuid.uuid4())
    )
    status_b, _ = _create_property(
        client, "Maple Court", organization_id=str(uuid.uuid4())
    )
    assert status_a == 201
    assert status_b == 201


def test_property_name_reusable_after_soft_delete(client: TestClient) -> None:
    org = str(uuid.uuid4())
    status_code, body = _create_property(client, "Maple Court", organization_id=org)
    assert status_code == 201

    assert client.delete(f"{PROPERTIES}/{body['id']}").status_code == 204

    # The name is free again once the original is soft-deleted.
    status_code, _ = _create_property(client, "Maple Court", organization_id=org)
    assert status_code == 201


def test_renaming_property_onto_existing_name_conflicts(client: TestClient) -> None:
    org = str(uuid.uuid4())
    _create_property(client, "Maple Court", organization_id=org)
    _, other = _create_property(client, "Oak Ridge", organization_id=org)

    resp = client.patch(f"{PROPERTIES}/{other['id']}", json={"name": "Maple Court"})
    assert resp.status_code == 409


def test_updating_property_keeping_its_own_name_succeeds(client: TestClient) -> None:
    org = str(uuid.uuid4())
    _, body = _create_property(client, "Maple Court", organization_id=org)

    # Patching other fields (or the same name) must not trip the self-collision.
    resp = client.patch(
        f"{PROPERTIES}/{body['id']}", json={"name": "Maple Court", "lat": 40.0}
    )
    assert resp.status_code == 200


def _create_unit(client: TestClient, property_id: str, name: str, price: int = 1200):
    return client.post(
        f"{PROPERTIES}/{property_id}/units", json={"name": name, "price": price}
    )


def test_duplicate_unit_name_in_same_property_conflicts(client: TestClient) -> None:
    _, prop = _create_property(client)
    assert _create_unit(client, prop["id"], "Unit 1").status_code == 201

    resp = _create_unit(client, prop["id"], "Unit 1")
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "conflict"


def test_same_unit_name_in_different_properties_is_allowed(client: TestClient) -> None:
    _, prop_a = _create_property(client, "Property A")
    _, prop_b = _create_property(client, "Property B")

    assert _create_unit(client, prop_a["id"], "Unit 1").status_code == 201
    assert _create_unit(client, prop_b["id"], "Unit 1").status_code == 201


def test_unit_name_reusable_after_soft_delete(client: TestClient) -> None:
    _, prop = _create_property(client)
    created = _create_unit(client, prop["id"], "Unit 1")
    assert created.status_code == 201

    unit_id = created.json()["id"]
    assert client.delete(f"/api/v1/units/{unit_id}").status_code == 204

    assert _create_unit(client, prop["id"], "Unit 1").status_code == 201


def test_renaming_unit_onto_existing_name_conflicts(client: TestClient) -> None:
    _, prop = _create_property(client)
    _create_unit(client, prop["id"], "Unit 1")
    other = _create_unit(client, prop["id"], "Unit 2").json()

    resp = client.patch(f"/api/v1/units/{other['id']}", json={"name": "Unit 1"})
    assert resp.status_code == 409
