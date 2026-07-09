import uuid

from fastapi.testclient import TestClient

PROPERTIES = "/api/v1/properties"
UNITS = "/api/v1/units"


def _create_property(client: TestClient) -> str:
    resp = client.post(
        PROPERTIES,
        json={
            "name": "Maple Court",
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


def test_search_units_under_a_property(client: TestClient) -> None:
    property_id = _create_property(client)
    _create_unit(client, property_id, "Penthouse")
    _create_unit(client, property_id, "Basement")

    body = client.get(
        f"{PROPERTIES}/{property_id}/units", params={"search": "pent"}
    ).json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Penthouse"


def test_search_flat_units_list(client: TestClient) -> None:
    property_id = _create_property(client)
    _create_unit(client, property_id, "Studio A")
    _create_unit(client, property_id, "Loft B")

    body = client.get(UNITS, params={"search": "studio"}).json()
    assert {u["name"] for u in body["items"]} == {"Studio A"}
