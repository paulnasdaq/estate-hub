from fastapi.testclient import TestClient

BASE = "/api/v1/organizations"


def _create(client: TestClient, name: str = "Acme") -> str:
    return client.post(BASE, json={"name": name}).json()["id"]


def test_list_empty(client: TestClient) -> None:
    body = client.get(BASE).json()
    assert body == {"items": [], "total": 0, "limit": 50, "offset": 0}


def test_create_organization(client: TestClient) -> None:
    resp = client.post(BASE, json={"name": "Acme Properties"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Acme Properties"
    assert body["deleted_at"] is None
    assert body["id"]
    assert body["created_at"]


def test_get_organization(client: TestClient) -> None:
    org_id = _create(client)
    resp = client.get(f"{BASE}/{org_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == org_id


def test_update_organization(client: TestClient) -> None:
    org_id = _create(client)
    resp = client.patch(f"{BASE}/{org_id}", json={"name": "Acme Realty"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Acme Realty"


def test_delete_is_soft_delete(client: TestClient) -> None:
    org_id = _create(client)

    assert client.delete(f"{BASE}/{org_id}").status_code == 204
    # Soft-deleted: 404 on reads and gone from the list.
    assert client.get(f"{BASE}/{org_id}").status_code == 404
    assert client.get(BASE).json()["total"] == 0
    edit = client.patch(f"{BASE}/{org_id}", json={"name": "x"})
    assert edit.status_code == 404


def test_pagination(client: TestClient) -> None:
    for i in range(3):
        _create(client, name=f"Org {i}")

    body = client.get(BASE, params={"limit": 2, "offset": 0}).json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["limit"] == 2

    page2 = client.get(BASE, params={"limit": 2, "offset": 2}).json()
    assert len(page2["items"]) == 1


def test_not_found_error_envelope(client: TestClient) -> None:
    unknown = "00000000-0000-0000-0000-000000000000"
    resp = client.get(f"{BASE}/{unknown}")
    assert resp.status_code == 404
    error = resp.json()["error"]
    assert error["code"] == "not_found"
    assert "not found" in error["message"]
    assert error["request_id"]


def test_validation_error_envelope(client: TestClient) -> None:
    resp = client.post(BASE, json={})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


def test_request_id_header(client: TestClient) -> None:
    resp = client.get(BASE)
    assert resp.headers["X-Request-ID"]

    # A supplied request id is echoed back.
    supplied = "test-request-id-123"
    resp = client.get(BASE, headers={"X-Request-ID": supplied})
    assert resp.headers["X-Request-ID"] == supplied
