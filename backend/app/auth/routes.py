import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.pagination import PaginationParams
from app.core.schemas import Page

from . import schemas
from .services import UserService

user_router = APIRouter(prefix="/users", tags=["users"])


@user_router.get("", response_model=Page[schemas.UserRead])
def list_users(
    pagination: PaginationParams = Depends(),
    search: str | None = Query(
        None, description="Case-insensitive match on name or email"
    ),
    db: Session = Depends(get_db),
) -> Page[schemas.UserRead]:
    items, total = UserService(db).list(
        pagination.limit, pagination.offset, search=search
    )
    return Page(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@user_router.post(
    "", response_model=schemas.UserRead, status_code=status.HTTP_201_CREATED
)
def create_user(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    return UserService(db).create(payload)


@user_router.get("/{user_id}", response_model=schemas.UserRead)
def get_user(user_id: uuid.UUID, db: Session = Depends(get_db)):
    return UserService(db).get(user_id)
