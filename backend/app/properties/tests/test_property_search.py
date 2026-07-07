import uuid

from fastapi.testclient import TestClient

PROPERTIES = "/api/v1/properties"


def _create_property(
    client: TestClient,
    *,
    name: str = "Maple Court",
    lat: float = 45.52,
    lng: float = -122.68,
    organization_id: str | None = None,
) -> str:
    resp = client.post(
        PROPERTIES,
        json={
            "name": name,
            "lat": lat,
            "lng": lng,
            "organization_id": organization_id or str(uuid.uuid4()),
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def test_search_matches_name_case_insensitively(client: TestClient) -> None:
    _create_property(client, name="Maple Court")
    _create_property(client, name="Oak Ridge")

    body = client.get(PROPERTIES, params={"search": "maple"}).json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Maple Court"


def test_search_matches_substring(client: TestClient) -> None:
    _create_property(client, name="Riverside Apartments")
    _create_property(client, name="Hilltop Homes")

    body = client.get(PROPERTIES, params={"search": "side"}).json()
    assert {p["name"] for p in body["items"]} == {"Riverside Apartments"}


def test_filter_by_organization(client: TestClient) -> None:
    org = str(uuid.uuid4())
    _create_property(client, name="Ours", organization_id=org)
    _create_property(client, name="Theirs")

    body = client.get(PROPERTIES, params={"organization_id": org}).json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Ours"


def test_radius_search_includes_near_and_excludes_far(client: TestClient) -> None:
    # Portland center; a point ~2 km away and one in another state.
    _create_property(client, name="Downtown", lat=45.5152, lng=-122.6784)
    _create_property(client, name="Nearby", lat=45.53, lng=-122.68)
    _create_property(client, name="Seattle", lat=47.6062, lng=-122.3321)

    body = client.get(
        PROPERTIES,
        params={"lat": 45.5152, "lng": -122.6784, "radius_km": 5},
    ).json()
    names = {p["name"] for p in body["items"]}
    assert "Downtown" in names
    assert "Nearby" in names
    assert "Seattle" not in names


def test_filters_combine(client: TestClient) -> None:
    org = str(uuid.uuid4())
    _create_property(client, name="Maple Court", organization_id=org)
    _create_property(client, name="Maple Grove")  # right name, wrong org
    _create_property(client, name="Oak Ridge", organization_id=org)  # wrong name

    body = client.get(
        PROPERTIES, params={"search": "maple", "organization_id": org}
    ).json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Maple Court"


def test_partial_geo_params_are_rejected(client: TestClient) -> None:
    resp = client.get(PROPERTIES, params={"lat": 45.5, "lng": -122.6})
    assert resp.status_code == 422


def test_no_filters_returns_everything(client: TestClient) -> None:
    _create_property(client, name="A")
    _create_property(client, name="B")

    body = client.get(PROPERTIES).json()
    assert body["total"] == 2
