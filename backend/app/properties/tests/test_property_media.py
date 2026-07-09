import uuid

from fastapi.testclient import TestClient

PROPERTIES = "/api/v1/properties"
MEDIA = "/api/v1/media"


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


def _presign(client: TestClient, property_id: str, filename: str, content_type: str):
    return client.post(
        f"{PROPERTIES}/{property_id}/media/presigns",
        json={"filename": filename, "content_type": content_type},
    )


def test_presign_image_key_uses_images_folder(client: TestClient) -> None:
    property_id = _create_property(client)
    resp = _presign(client, property_id, "kitchen.jpg", "image/jpeg")
    assert resp.status_code == 200
    body = resp.json()
    assert body["storage_key"] == f"properties/{property_id}/images/kitchen.jpg"
    assert body["upload_url"]
    # The presigned URL targets the derived key.
    assert body["storage_key"] in body["upload_url"]


def test_presign_video_key_uses_videos_folder(client: TestClient) -> None:
    property_id = _create_property(client)
    resp = _presign(client, property_id, "tour.mp4", "video/mp4")
    assert resp.status_code == 200
    assert (
        resp.json()["storage_key"]
        == f"properties/{property_id}/videos/tour.mp4"
    )


def test_presign_other_key_uses_files_folder(client: TestClient) -> None:
    property_id = _create_property(client)
    resp = _presign(client, property_id, "lease.pdf", "application/pdf")
    assert resp.status_code == 200
    assert (
        resp.json()["storage_key"]
        == f"properties/{property_id}/files/lease.pdf"
    )


def test_presign_unknown_property_is_404(client: TestClient) -> None:
    resp = _presign(client, str(uuid.uuid4()), "kitchen.jpg", "image/jpeg")
    assert resp.status_code == 404


def test_presign_rejects_filename_with_path_separator(client: TestClient) -> None:
    property_id = _create_property(client)
    resp = _presign(client, property_id, "../secret.jpg", "image/jpeg")
    assert resp.status_code == 422


def _create_media(
    client: TestClient, property_id: str, storage_key: str, display_order: int = 0
):
    return client.post(
        MEDIA,
        json={
            "entity_type": "property",
            "entity_id": property_id,
            "storage_key": storage_key,
            "content_type": "image/jpeg",
            "size_bytes": 1024,
            "display_order": display_order,
        },
    )


def test_list_property_media_returns_media_for_property(client: TestClient) -> None:
    property_id = _create_property(client)
    _create_media(client, property_id, "a", display_order=2)
    _create_media(client, property_id, "b", display_order=1)
    # Media for a different property must not leak in.
    _create_media(client, _create_property(client, "Elm"), "c")

    resp = client.get(f"{PROPERTIES}/{property_id}/media")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    # Ordered by display_order ascending.
    assert [m["storage_key"] for m in body["items"]] == ["b", "a"]
    # Each item carries a presigned download URL for direct rendering.
    for item in body["items"]:
        assert item["storage_key"] in item["url"]


def test_list_property_media_empty(client: TestClient) -> None:
    property_id = _create_property(client)
    resp = client.get(f"{PROPERTIES}/{property_id}/media")
    assert resp.status_code == 200
    assert resp.json() == {"items": [], "total": 0, "limit": 50, "offset": 0}


def test_list_property_media_unknown_property_is_404(client: TestClient) -> None:
    resp = client.get(f"{PROPERTIES}/{uuid.uuid4()}/media")
    assert resp.status_code == 404
