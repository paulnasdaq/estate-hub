from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.pagination import PaginationParams
from app.core.schemas import Page

from . import models, schemas
from .dependencies import get_property_or_404, get_unit_or_404
from .services import PropertyService, UnitService

property_router = APIRouter(prefix="/properties", tags=["properties"])
unit_router = APIRouter(prefix="/units", tags=["units"])


@property_router.get("", response_model=Page[schemas.PropertyRead])
def list_properties(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
) -> Page[schemas.PropertyRead]:
    items, total = PropertyService(db).list(pagination.limit, pagination.offset)
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


@unit_router.get("", response_model=Page[schemas.UnitRead])
def list_units(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
) -> Page[schemas.UnitRead]:
    items, total = UnitService(db).list(pagination.limit, pagination.offset)
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
