import uuid

from fastapi.testclient import TestClient

PROPERTIES = "/api/v1/properties"


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


def _create_unit(client: TestClient, property_id: str, name: str, price: int = 1200):
    return client.post(
        f"{PROPERTIES}/{property_id}/units", json={"name": name, "price": price}
    )


def test_list_units_empty(client: TestClient) -> None:
    property_id = _create_property(client)
    body = client.get(f"{PROPERTIES}/{property_id}/units").json()
    assert body == {"items": [], "total": 0, "limit": 50, "offset": 0}


def test_create_unit_under_property(client: TestClient) -> None:
    property_id = _create_property(client)

    resp = _create_unit(client, property_id, "Unit 1", price=1200)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Unit 1"
    assert body["price"] == 1200
    # The property is taken from the path, not the body.
    assert body["property_id"] == property_id
    assert body["id"]
    assert body["created_at"]
    assert body["deleted_at"] is None


def test_create_unit_requires_price(client: TestClient) -> None:
    property_id = _create_property(client)

    resp = client.post(f"{PROPERTIES}/{property_id}/units", json={"name": "Unit 1"})
    assert resp.status_code == 422


def test_create_unit_rejects_negative_price(client: TestClient) -> None:
    property_id = _create_property(client)

    resp = _create_unit(client, property_id, "Unit 1", price=-1)
    assert resp.status_code == 422


def test_created_unit_appears_in_list(client: TestClient) -> None:
    property_id = _create_property(client)
    _create_unit(client, property_id, "Unit 1")
    _create_unit(client, property_id, "Unit 2")

    body = client.get(f"{PROPERTIES}/{property_id}/units").json()
    assert body["total"] == 2
    assert {u["name"] for u in body["items"]} == {"Unit 1", "Unit 2"}


def test_list_scoped_to_the_property(client: TestClient) -> None:
    property_a = _create_property(client, name="Property A")
    property_b = _create_property(client, name="Property B")
    _create_unit(client, property_a, "A-1")
    _create_unit(client, property_b, "B-1")

    body_a = client.get(f"{PROPERTIES}/{property_a}/units").json()
    assert body_a["total"] == 1
    assert body_a["items"][0]["name"] == "A-1"


def test_units_pagination(client: TestClient) -> None:
    property_id = _create_property(client)
    for i in range(3):
        _create_unit(client, property_id, f"Unit {i}")

    page1 = client.get(
        f"{PROPERTIES}/{property_id}/units", params={"limit": 2, "offset": 0}
    ).json()
    assert page1["total"] == 3
    assert len(page1["items"]) == 2

    page2 = client.get(
        f"{PROPERTIES}/{property_id}/units", params={"limit": 2, "offset": 2}
    ).json()
    assert len(page2["items"]) == 1


def test_unknown_property_returns_404(client: TestClient) -> None:
    unknown = uuid.uuid4()
    assert client.get(f"{PROPERTIES}/{unknown}/units").status_code == 404
    create = _create_unit(client, str(unknown), "Unit 1")
    assert create.status_code == 404


def test_create_unit_requires_name(client: TestClient) -> None:
    property_id = _create_property(client)
    resp = client.post(f"{PROPERTIES}/{property_id}/units", json={})
    assert resp.status_code == 422
