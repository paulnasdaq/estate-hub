from fastapi.testclient import TestClient

from conftest import FakeS3Client

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
    # Contact fields are optional and default to null when omitted.
    assert body["email"] is None
    assert body["phone"] is None
    assert body["website"] is None


def test_create_organization_with_contact_fields(client: TestClient) -> None:
    resp = client.post(
        BASE,
        json={
            "name": "Acme Properties",
            "email": "hello@acme.com",
            "phone": "+254700000000",
            "website": "https://acme.test",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "hello@acme.com"
    assert body["phone"] == "+254700000000"
    assert body["website"] == "https://acme.test"


def test_create_organization_rejects_invalid_email(client: TestClient) -> None:
    resp = client.post(BASE, json={"name": "Acme", "email": "not-an-email"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation_error"


def test_update_organization_contact_fields(client: TestClient) -> None:
    org_id = _create(client)
    resp = client.patch(
        f"{BASE}/{org_id}",
        json={"phone": "+254711111111", "website": "https://acme.test"},
    )
    assert resp.status_code == 200
    body = resp.json()
    # Untouched name is preserved; the patched fields are updated.
    assert body["name"] == "Acme"
    assert body["phone"] == "+254711111111"
    assert body["website"] == "https://acme.test"


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


def test_logo_presign_returns_scoped_key(client: TestClient) -> None:
    org_id = _create(client)
    resp = client.post(
        f"{BASE}/{org_id}/logo/presigns",
        json={"filename": "logo.png", "content_type": "image/png"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["storage_key"] == f"organizations/{org_id}/logo/logo.png"
    assert body["upload_url"]


def test_logo_presign_rejects_non_image(client: TestClient) -> None:
    org_id = _create(client)
    resp = client.post(
        f"{BASE}/{org_id}/logo/presigns",
        json={"filename": "logo.pdf", "content_type": "application/pdf"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "invalid_organization_logo"


def test_set_logo_records_public_url(client: TestClient) -> None:
    org_id = _create(client)
    key = f"organizations/{org_id}/logo/logo.png"
    resp = client.put(f"{BASE}/{org_id}/logo", json={"storage_key": key})
    assert resp.status_code == 200
    body = resp.json()
    assert body["logo_url"].endswith(key)
    # The URL is now returned when reading the organization.
    assert client.get(f"{BASE}/{org_id}").json()["logo_url"] == body["logo_url"]


def test_set_logo_rejects_key_outside_organization(client: TestClient) -> None:
    org_id = _create(client)
    other = _create(client)
    resp = client.put(
        f"{BASE}/{org_id}/logo",
        json={"storage_key": f"organizations/{other}/logo/logo.png"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "invalid_organization_logo"


def test_set_logo_rejects_missing_object(
    client: TestClient, s3_stub: FakeS3Client
) -> None:
    org_id = _create(client)
    s3_stub.exists_result = False
    resp = client.put(
        f"{BASE}/{org_id}/logo",
        json={"storage_key": f"organizations/{org_id}/logo/logo.png"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "media_file_missing"


def test_replacing_logo_deletes_previous_object(
    client: TestClient, s3_stub: FakeS3Client
) -> None:
    org_id = _create(client)
    first = f"organizations/{org_id}/logo/old.png"
    second = f"organizations/{org_id}/logo/new.png"
    client.put(f"{BASE}/{org_id}/logo", json={"storage_key": first})
    client.put(f"{BASE}/{org_id}/logo", json={"storage_key": second})
    # The superseded object was removed from storage.
    assert s3_stub.deleted == [first]
    assert client.get(f"{BASE}/{org_id}").json()["logo_url"].endswith(second)


def test_delete_logo_clears_url_and_object(
    client: TestClient, s3_stub: FakeS3Client
) -> None:
    org_id = _create(client)
    key = f"organizations/{org_id}/logo/logo.png"
    client.put(f"{BASE}/{org_id}/logo", json={"storage_key": key})
    resp = client.delete(f"{BASE}/{org_id}/logo")
    assert resp.status_code == 200
    assert resp.json()["logo_url"] is None
    assert s3_stub.deleted == [key]
    assert client.get(f"{BASE}/{org_id}").json()["logo_url"] is None


def test_request_id_header(client: TestClient) -> None:
    resp = client.get(BASE)
    assert resp.headers["X-Request-ID"]

    # A supplied request id is echoed back.
    supplied = "test-request-id-123"
    resp = client.get(BASE, headers={"X-Request-ID": supplied})
    assert resp.headers["X-Request-ID"] == supplied
