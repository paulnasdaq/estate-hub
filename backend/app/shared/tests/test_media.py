import uuid

import boto3
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.shared.services import MediaService
from conftest import FakeS3Client

MEDIA = "/api/v1/media"


def _real_media_service(db_session: Session) -> MediaService:
    # A real boto3 client signs/presigns fully offline given dummy credentials,
    # so presigned-URL generation can be tested without touching AWS.
    client = boto3.client(
        "s3",
        region_name="us-east-1",
        aws_access_key_id="test",
        aws_secret_access_key="test",
    )
    return MediaService(db_session, client)


def _create_media(
    client: TestClient,
    *,
    entity_type: str = "property",
    entity_id: str | None = None,
    storage_key: str = "properties/1/cover.jpg",
    is_primary: bool = False,
    display_order: int = 0,
):
    return client.post(
        MEDIA,
        json={
            "entity_type": entity_type,
            "entity_id": entity_id or str(uuid.uuid4()),
            "storage_key": storage_key,
            "content_type": "image/jpeg",
            "size_bytes": 2048,
            "is_primary": is_primary,
            "display_order": display_order,
        },
    )


def test_create_media(client: TestClient) -> None:
    entity_id = str(uuid.uuid4())
    resp = _create_media(client, entity_id=entity_id, is_primary=True)
    assert resp.status_code == 201
    body = resp.json()
    assert body["entity_type"] == "property"
    assert body["entity_id"] == entity_id
    assert body["storage_key"] == "properties/1/cover.jpg"
    assert body["content_type"] == "image/jpeg"
    assert body["size_bytes"] == 2048
    assert body["is_primary"] is True
    assert body["display_order"] == 0
    assert body["id"]
    assert body["created_at"]
    assert body["deleted_at"] is None


def test_create_media_defaults(client: TestClient) -> None:
    resp = client.post(
        MEDIA,
        json={
            "entity_type": "unit",
            "entity_id": str(uuid.uuid4()),
            "storage_key": "units/1/floorplan.png",
            "content_type": "image/png",
            "size_bytes": 100,
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["is_primary"] is False
    assert body["display_order"] == 0


def test_create_media_rejects_negative_size(client: TestClient) -> None:
    resp = _create_media(client, storage_key="x")
    assert resp.status_code == 201
    resp = client.post(
        MEDIA,
        json={
            "entity_type": "property",
            "entity_id": str(uuid.uuid4()),
            "storage_key": "y",
            "content_type": "image/jpeg",
            "size_bytes": -1,
        },
    )
    assert resp.status_code == 422


def test_create_media_rejects_missing_object(
    client: TestClient, s3_stub: FakeS3Client
) -> None:
    # The referenced object is not in storage.
    s3_stub.exists_result = False
    resp = _create_media(client)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "media_file_missing"


def test_list_media_for_entity(client: TestClient) -> None:
    entity_id = str(uuid.uuid4())
    _create_media(client, entity_id=entity_id, storage_key="a", display_order=2)
    _create_media(client, entity_id=entity_id, storage_key="b", display_order=1)
    # A different entity's media must not leak into the results.
    _create_media(client, entity_id=str(uuid.uuid4()), storage_key="c")

    body = client.get(
        MEDIA, params={"entity_type": "property", "entity_id": entity_id}
    ).json()
    assert body["total"] == 2
    # Ordered by display_order ascending.
    assert [m["storage_key"] for m in body["items"]] == ["b", "a"]


def test_list_media_empty(client: TestClient) -> None:
    body = client.get(
        MEDIA,
        params={"entity_type": "property", "entity_id": str(uuid.uuid4())},
    ).json()
    assert body == {"items": [], "total": 0, "limit": 50, "offset": 0}


def test_get_media(client: TestClient) -> None:
    media_id = _create_media(client).json()["id"]
    resp = client.get(f"{MEDIA}/{media_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == media_id


def test_get_media_not_found(client: TestClient) -> None:
    resp = client.get(f"{MEDIA}/{uuid.uuid4()}")
    assert resp.status_code == 404


def test_update_media(client: TestClient) -> None:
    media_id = _create_media(client).json()["id"]
    resp = client.patch(
        f"{MEDIA}/{media_id}", json={"is_primary": True, "display_order": 5}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_primary"] is True
    assert body["display_order"] == 5


def test_presigned_download_url(db_session: Session) -> None:
    url = _real_media_service(db_session).generate_presigned_download_url(
        "photos/x.jpg"
    )
    assert "photos/x.jpg" in url
    assert "Signature=" in url


def test_presigned_upload_url_includes_content_type(db_session: Session) -> None:
    url = _real_media_service(db_session).generate_presigned_upload_url(
        "photos/x.jpg", "image/jpeg"
    )
    assert "photos/x.jpg" in url
    assert "content-type=image%2Fjpeg" in url
    assert "Signature=" in url


def test_delete_media(client: TestClient, s3_stub: FakeS3Client) -> None:
    body = _create_media(client, storage_key="properties/1/gone.jpg").json()
    media_id = body["id"]
    resp = client.delete(f"{MEDIA}/{media_id}")
    assert resp.status_code == 204
    # Soft-deleted media is no longer retrievable.
    assert client.get(f"{MEDIA}/{media_id}").status_code == 404
    # The underlying object was removed from storage too.
    assert s3_stub.deleted == ["properties/1/gone.jpg"]
