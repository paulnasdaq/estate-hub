import uuid

from fastapi.testclient import TestClient

PROPERTIES = "/api/v1/properties"
UNITS = "/api/v1/units"
MEDIA = "/api/v1/media"


def _create_unit(client: TestClient, name: str = "Unit 1") -> str:
    # Create the owning property first, then a unit under it.
    prop = client.post(
        PROPERTIES,
        json={
            "name": "Maple Court",
            "lat": 45.52,
            "lng": -122.68,
            "organization_id": str(uuid.uuid4()),
        },
    )
    assert prop.status_code == 201
    resp = client.post(
        f"{PROPERTIES}/{prop.json()['id']}/units",
        json={"name": name, "price": 1200},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def _presign(client: TestClient, unit_id: str, filename: str, content_type: str):
    return client.post(
        f"{UNITS}/{unit_id}/media/presigns",
        json={"filename": filename, "content_type": content_type},
    )


def test_presign_image_key_uses_images_folder(client: TestClient) -> None:
    unit_id = _create_unit(client)
    resp = _presign(client, unit_id, "kitchen.jpg", "image/jpeg")
    assert resp.status_code == 200
    body = resp.json()
    assert body["storage_key"] == f"units/{unit_id}/images/kitchen.jpg"
    assert body["upload_url"]
    # The presigned URL targets the derived key.
    assert body["storage_key"] in body["upload_url"]


def test_presign_video_key_uses_videos_folder(client: TestClient) -> None:
    unit_id = _create_unit(client)
    resp = _presign(client, unit_id, "tour.mp4", "video/mp4")
    assert resp.status_code == 200
    assert resp.json()["storage_key"] == f"units/{unit_id}/videos/tour.mp4"


def test_presign_other_key_uses_files_folder(client: TestClient) -> None:
    unit_id = _create_unit(client)
    resp = _presign(client, unit_id, "lease.pdf", "application/pdf")
    assert resp.status_code == 200
    assert resp.json()["storage_key"] == f"units/{unit_id}/files/lease.pdf"


def test_presign_unknown_unit_is_404(client: TestClient) -> None:
    resp = _presign(client, str(uuid.uuid4()), "kitchen.jpg", "image/jpeg")
    assert resp.status_code == 404


def test_presign_rejects_filename_with_path_separator(client: TestClient) -> None:
    unit_id = _create_unit(client)
    resp = _presign(client, unit_id, "../secret.jpg", "image/jpeg")
    assert resp.status_code == 422


def _create_media(
    client: TestClient, unit_id: str, storage_key: str, display_order: int = 0
):
    return client.post(
        MEDIA,
        json={
            "entity_type": "unit",
            "entity_id": unit_id,
            "storage_key": storage_key,
            "content_type": "image/jpeg",
            "size_bytes": 1024,
            "display_order": display_order,
        },
    )


def test_list_unit_media_returns_media_for_unit(client: TestClient) -> None:
    unit_id = _create_unit(client)
    _create_media(client, unit_id, "a", display_order=2)
    _create_media(client, unit_id, "b", display_order=1)
    # Media for a different unit must not leak in.
    _create_media(client, _create_unit(client, "Unit 2"), "c")

    resp = client.get(f"{UNITS}/{unit_id}/media")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    # Ordered by display_order ascending.
    assert [m["storage_key"] for m in body["items"]] == ["b", "a"]
    # Each item carries a public URL for direct rendering.
    for item in body["items"]:
        assert item["storage_key"] in item["url"]


def test_list_unit_media_empty(client: TestClient) -> None:
    unit_id = _create_unit(client)
    resp = client.get(f"{UNITS}/{unit_id}/media")
    assert resp.status_code == 200
    assert resp.json() == {"items": [], "total": 0, "limit": 50, "offset": 0}


def test_list_unit_media_unknown_unit_is_404(client: TestClient) -> None:
    resp = client.get(f"{UNITS}/{uuid.uuid4()}/media")
    assert resp.status_code == 404


def test_unit_media_does_not_leak_into_property_media(client: TestClient) -> None:
    # A unit's media is scoped by entity_type, so it must not surface under the
    # property listing even if ids were to collide.
    unit_id = _create_unit(client)
    _create_media(client, unit_id, "unit-only")

    resp = client.get(f"{PROPERTIES}/{unit_id}/media")
    # That id isn't a property, so the property lookup 404s.
    assert resp.status_code == 404