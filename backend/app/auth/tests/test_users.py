from fastapi.testclient import TestClient

BASE = "/api/v1/users"
ORGS = "/api/v1/organizations"


def _create_org(client: TestClient, name: str = "Acme") -> str:
    return client.post(ORGS, json={"name": name}).json()["id"]


def _payload(org_id: str, **overrides: object) -> dict:
    payload = {
        "first_name": "Ada",
        "last_name": "Lovelace",
        "email": "ada@example.com",
        "phone": "+15550001111",
        "organization_id": org_id,
    }
    payload.update(overrides)
    return payload


def test_list_empty(client: TestClient) -> None:
    body = client.get(BASE).json()
    assert body == {"items": [], "total": 0, "limit": 50, "offset": 0}


def test_list_returns_users(client: TestClient) -> None:
    org_id = _create_org(client)
    client.post(BASE, json=_payload(org_id, email="a@example.com"))
    client.post(BASE, json=_payload(org_id, email="b@example.com"))

    body = client.get(BASE).json()
    assert body["total"] == 2
    assert len(body["items"]) == 2
    # Newest-first ordering.
    assert body["items"][0]["email"] == "b@example.com"
    assert len(body["items"][0]["accounts"]) == 1


def test_list_pagination(client: TestClient) -> None:
    org_id = _create_org(client)
    for i in range(3):
        client.post(BASE, json=_payload(org_id, email=f"user{i}@example.com"))

    page1 = client.get(BASE, params={"limit": 2, "offset": 0}).json()
    assert page1["total"] == 3
    assert len(page1["items"]) == 2
    assert page1["limit"] == 2

    page2 = client.get(BASE, params={"limit": 2, "offset": 2}).json()
    assert len(page2["items"]) == 1


def test_create_user_creates_account(client: TestClient) -> None:
    org_id = _create_org(client)

    resp = client.post(BASE, json=_payload(org_id))

    assert resp.status_code == 201
    body = resp.json()
    assert body["first_name"] == "Ada"
    assert body["last_name"] == "Lovelace"
    assert body["email"] == "ada@example.com"
    assert body["phone"] == "+15550001111"
    assert body["id"]
    # A single account was created and scoped to the organization.
    assert len(body["accounts"]) == 1
    assert body["accounts"][0]["organization_id"] == org_id


def test_create_user_without_phone(client: TestClient) -> None:
    org_id = _create_org(client)

    resp = client.post(BASE, json=_payload(org_id, phone=None))

    assert resp.status_code == 201
    assert resp.json()["phone"] is None


def test_duplicate_email_conflicts(client: TestClient) -> None:
    org_id = _create_org(client)
    assert client.post(BASE, json=_payload(org_id)).status_code == 201

    resp = client.post(BASE, json=_payload(org_id))
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "conflict"


def test_unknown_organization_is_404(client: TestClient) -> None:
    unknown = "00000000-0000-0000-0000-000000000000"
    resp = client.post(BASE, json=_payload(unknown))
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_invalid_email_is_422(client: TestClient) -> None:
    org_id = _create_org(client)
    resp = client.post(BASE, json=_payload(org_id, email="not-an-email"))
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


def test_missing_fields_is_422(client: TestClient) -> None:
    resp = client.post(BASE, json={"first_name": "Ada"})
    assert resp.status_code == 422
