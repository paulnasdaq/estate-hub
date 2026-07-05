from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.pagination import PaginationParams
from app.core.schemas import Page

from . import models, schemas
from .dependencies import get_organization_or_404
from .services import OrganizationService

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("", response_model=Page[schemas.OrganizationRead])
def list_organizations(
    pagination: PaginationParams = Depends(),
    db: Session = Depends(get_db),
) -> Page[schemas.OrganizationRead]:
    items, total = OrganizationService(db).list(pagination.limit, pagination.offset)
    return Page(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.post(
    "", response_model=schemas.OrganizationRead, status_code=status.HTTP_201_CREATED
)
def create_organization(
    payload: schemas.OrganizationCreate, db: Session = Depends(get_db)
):
    return OrganizationService(db).create(payload)


@router.get("/{org_id}", response_model=schemas.OrganizationRead)
def get_organization(
    org: models.Organization = Depends(get_organization_or_404),
):
    return org


@router.patch("/{org_id}", response_model=schemas.OrganizationRead)
def update_organization(
    payload: schemas.OrganizationUpdate,
    org: models.Organization = Depends(get_organization_or_404),
    db: Session = Depends(get_db),
):
    return OrganizationService(db).update(org, payload)


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization(
    org: models.Organization = Depends(get_organization_or_404),
    db: Session = Depends(get_db),
) -> Response:
    OrganizationService(db).delete(org)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
