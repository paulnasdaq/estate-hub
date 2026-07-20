from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.pagination import PaginationParams
from app.core.schemas import Page
from app.shared.dependencies import get_media_service
from app.shared.schemas import MediaPresignRequest, MediaPresignResponse
from app.shared.services import MediaService

from . import models, schemas
from .dependencies import get_organization_or_404
from .exceptions import InvalidOrganizationLogoError
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


@router.post("/{org_id}/logo/presigns", response_model=MediaPresignResponse)
def create_organization_logo_presign(
    payload: MediaPresignRequest,
    org: models.Organization = Depends(get_organization_or_404),
    media: MediaService = Depends(get_media_service),
) -> MediaPresignResponse:
    # Logos must be images, and the object is stored under a key scoped to the
    # organization: organizations/<id>/logo/<filename>.
    if not payload.content_type.startswith("image/"):
        raise InvalidOrganizationLogoError(
            f"Logo must be an image, got '{payload.content_type}'"
        )
    key = OrganizationService.logo_key_prefix(org.id) + payload.filename
    upload_url = media.generate_presigned_upload_url(key, payload.content_type)
    return MediaPresignResponse(storage_key=key, upload_url=upload_url)


@router.put("/{org_id}/logo", response_model=schemas.OrganizationRead)
def set_organization_logo(
    payload: schemas.OrganizationLogoSet,
    org: models.Organization = Depends(get_organization_or_404),
    db: Session = Depends(get_db),
    media: MediaService = Depends(get_media_service),
):
    return OrganizationService(db).set_logo(org, payload.storage_key, media)


@router.delete("/{org_id}/logo", response_model=schemas.OrganizationRead)
def delete_organization_logo(
    org: models.Organization = Depends(get_organization_or_404),
    db: Session = Depends(get_db),
    media: MediaService = Depends(get_media_service),
):
    return OrganizationService(db).clear_logo(org, media)
