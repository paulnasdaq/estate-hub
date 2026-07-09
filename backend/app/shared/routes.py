import uuid

from fastapi import APIRouter, Depends, Query, Response, status

from app.core.pagination import PaginationParams
from app.core.schemas import Page

from . import models, schemas
from .dependencies import get_media_or_404, get_media_service
from .services import MediaService

media_router = APIRouter(prefix="/media", tags=["media"])


@media_router.get("", response_model=Page[schemas.MediaRead])
def list_media(
    entity_type: str = Query(description="The kind of entity, e.g. 'property'"),
    entity_id: uuid.UUID = Query(description="The owning entity's id"),
    pagination: PaginationParams = Depends(),
    service: MediaService = Depends(get_media_service),
) -> Page[schemas.MediaRead]:
    items, total = service.list_for_entity(
        entity_type, entity_id, pagination.limit, pagination.offset
    )
    return Page(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@media_router.post(
    "", response_model=schemas.MediaRead, status_code=status.HTTP_201_CREATED
)
def create_media(
    payload: schemas.MediaCreate,
    service: MediaService = Depends(get_media_service),
):
    return service.create(payload)


@media_router.get("/{media_id}", response_model=schemas.MediaRead)
def get_media(
    media: models.Media = Depends(get_media_or_404),
):
    return media


@media_router.patch("/{media_id}", response_model=schemas.MediaRead)
def update_media(
    payload: schemas.MediaUpdate,
    media: models.Media = Depends(get_media_or_404),
    service: MediaService = Depends(get_media_service),
):
    return service.update(media, payload)


@media_router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(
    media: models.Media = Depends(get_media_or_404),
    service: MediaService = Depends(get_media_service),
) -> Response:
    service.delete(media)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
