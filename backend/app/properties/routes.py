from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.pagination import PaginationParams
from app.core.schemas import Page
from app.shared.dependencies import get_media_service
from app.shared.schemas import (
    MediaPresignRequest,
    MediaPresignResponse,
    MediaRead,
    MediaWithUrl,
)
from app.shared.services import MediaService

from . import models, schemas
from .dependencies import PropertyFilters, get_property_or_404, get_unit_or_404
from .services import PropertyService, UnitService

property_router = APIRouter(prefix="/properties", tags=["properties"])
unit_router = APIRouter(prefix="/units", tags=["units"])


@property_router.get("", response_model=Page[schemas.PropertyRead])
def list_properties(
    pagination: PaginationParams = Depends(),
    filters: PropertyFilters = Depends(),
    db: Session = Depends(get_db),
) -> Page[schemas.PropertyRead]:
    items, total = PropertyService(db).list(
        pagination.limit,
        pagination.offset,
        search=filters.search,
        organization_id=filters.organization_id,
        bbox=filters.bbox,
    )
    return Page(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@property_router.post(
    "", response_model=schemas.PropertyRead, status_code=status.HTTP_201_CREATED
)
def create_property(payload: schemas.PropertyCreate, db: Session = Depends(get_db)):
    return PropertyService(db).create(payload)


@property_router.get("/{property_id}", response_model=schemas.PropertyRead)
def get_property(
    prop: models.Property = Depends(get_property_or_404),
):
    return prop


@property_router.patch("/{property_id}", response_model=schemas.PropertyRead)
def update_property(
    payload: schemas.PropertyUpdate,
    prop: models.Property = Depends(get_property_or_404),
    db: Session = Depends(get_db),
):
    return PropertyService(db).update(prop, payload)


@property_router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_property(
    prop: models.Property = Depends(get_property_or_404),
    db: Session = Depends(get_db),
) -> Response:
    PropertyService(db).delete(prop)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@property_router.get("/{property_id}/units", response_model=Page[schemas.UnitRead])
def list_property_units(
    pagination: PaginationParams = Depends(),
    search: str | None = Query(
        None, description="Case-insensitive match on the unit name"
    ),
    prop: models.Property = Depends(get_property_or_404),
    db: Session = Depends(get_db),
) -> Page[schemas.UnitRead]:
    items, total = UnitService(db).list_for_property(
        prop.id, pagination.limit, pagination.offset, search=search
    )
    return Page(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@property_router.post(
    "/{property_id}/units",
    response_model=schemas.UnitRead,
    status_code=status.HTTP_201_CREATED,
)
def create_property_unit(
    payload: schemas.UnitCreateNested,
    prop: models.Property = Depends(get_property_or_404),
    db: Session = Depends(get_db),
):
    # The property comes from the path (validated by the dependency); the body
    # only carries the unit's own fields.
    return UnitService(db).create(
        schemas.UnitCreate(name=payload.name, price=payload.price, property_id=prop.id)
    )


@property_router.get("/{property_id}/media", response_model=Page[MediaWithUrl])
def list_property_media(
    pagination: PaginationParams = Depends(),
    prop: models.Property = Depends(get_property_or_404),
    service: MediaService = Depends(get_media_service),
) -> Page[MediaWithUrl]:
    items, total = service.list_for_entity(
        "property", prop.id, pagination.limit, pagination.offset
    )
    # Attach the object's public URL to each item so the client can render it
    # directly from the (public) media bucket.
    media = [
        MediaWithUrl(
            **MediaRead.model_validate(item).model_dump(),
            url=service.public_url(item.storage_key),
        )
        for item in items
    ]
    return Page(
        items=media,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@property_router.post(
    "/{property_id}/media/presigns", response_model=MediaPresignResponse
)
def create_property_media_presign(
    payload: MediaPresignRequest,
    prop: models.Property = Depends(get_property_or_404),
    service: MediaService = Depends(get_media_service),
) -> MediaPresignResponse:
    # Derive a storage key scoped to the property, foldered by media kind:
    # properties/<id>/(images|videos|files)/<filename>.
    category = MediaService.storage_category(payload.content_type)
    key = f"properties/{prop.id}/{category}/{payload.filename}"
    upload_url = service.generate_presigned_upload_url(key, payload.content_type)
    return MediaPresignResponse(storage_key=key, upload_url=upload_url)


@unit_router.get("", response_model=Page[schemas.UnitRead])
def list_units(
    pagination: PaginationParams = Depends(),
    search: str | None = Query(
        None, description="Case-insensitive match on the unit name"
    ),
    db: Session = Depends(get_db),
) -> Page[schemas.UnitRead]:
    items, total = UnitService(db).list(
        pagination.limit, pagination.offset, search=search
    )
    return Page(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@unit_router.post(
    "", response_model=schemas.UnitRead, status_code=status.HTTP_201_CREATED
)
def create_unit(payload: schemas.UnitCreate, db: Session = Depends(get_db)):
    return UnitService(db).create(payload)


@unit_router.get("/{unit_id}", response_model=schemas.UnitRead)
def get_unit(
    unit: models.Unit = Depends(get_unit_or_404),
):
    return unit


@unit_router.patch("/{unit_id}", response_model=schemas.UnitRead)
def update_unit(
    payload: schemas.UnitUpdate,
    unit: models.Unit = Depends(get_unit_or_404),
    db: Session = Depends(get_db),
):
    return UnitService(db).update(unit, payload)


@unit_router.delete("/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_unit(
    unit: models.Unit = Depends(get_unit_or_404),
    db: Session = Depends(get_db),
) -> Response:
    UnitService(db).delete(unit)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@unit_router.get("/{unit_id}/media", response_model=Page[MediaWithUrl])
def list_unit_media(
    pagination: PaginationParams = Depends(),
    unit: models.Unit = Depends(get_unit_or_404),
    service: MediaService = Depends(get_media_service),
) -> Page[MediaWithUrl]:
    items, total = service.list_for_entity(
        "unit", unit.id, pagination.limit, pagination.offset
    )
    # Attach the object's public URL to each item so the client can render it
    # directly from the (public) media bucket.
    media = [
        MediaWithUrl(
            **MediaRead.model_validate(item).model_dump(),
            url=service.public_url(item.storage_key),
        )
        for item in items
    ]
    return Page(
        items=media,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@unit_router.post("/{unit_id}/media/presigns", response_model=MediaPresignResponse)
def create_unit_media_presign(
    payload: MediaPresignRequest,
    unit: models.Unit = Depends(get_unit_or_404),
    service: MediaService = Depends(get_media_service),
) -> MediaPresignResponse:
    # Derive a storage key scoped to the unit, foldered by media kind:
    # units/<id>/(images|videos|files)/<filename>.
    category = MediaService.storage_category(payload.content_type)
    key = f"units/{unit.id}/{category}/{payload.filename}"
    upload_url = service.generate_presigned_upload_url(key, payload.content_type)
    return MediaPresignResponse(storage_key=key, upload_url=upload_url)
