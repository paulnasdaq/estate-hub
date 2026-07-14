from collections.abc import Generator

import pytest
from botocore.exceptions import ClientError
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import registry  # noqa: F401  (registers all models on Base.metadata)
from app.core.celery_app import celery_app
from app.core.database import Base, get_db
from app.core.s3 import get_s3_client
from app.main import app

# Run Celery tasks inline in the calling process (no broker/worker needed) and
# re-raise task errors so assertions see them.
celery_app.conf.task_always_eager = True
celery_app.conf.task_eager_propagates = True


class FakeS3Client:
    """In-memory stand-in for a boto3 S3 client so tests never touch storage.

    ``exists_result`` toggles what ``head_object`` reports; ``deleted`` records
    the keys passed to ``delete_object`` so tests can assert cleanup happened.
    """

    def __init__(self) -> None:
        self.exists_result = True
        self.deleted: list[str] = []

    def head_object(self, Bucket: str, Key: str) -> dict:  # noqa: N803
        if not self.exists_result:
            raise ClientError(
                {"Error": {"Code": "404", "Message": "Not Found"}}, "HeadObject"
            )
        return {}

    def delete_object(self, Bucket: str, Key: str) -> dict:  # noqa: N803
        self.deleted.append(Key)
        return {}

    def generate_presigned_url(
        self, ClientMethod: str, Params: dict, ExpiresIn: int  # noqa: N803
    ) -> str:
        return (
            f"https://s3.test/{Params['Bucket']}/{Params['Key']}"
            f"?method={ClientMethod}&expires={ExpiresIn}"
        )


@pytest.fixture
def s3_stub() -> FakeS3Client:
    return FakeS3Client()


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """A fresh in-memory SQLite database per test."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = testing_session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def client(
    db_session: Session, s3_stub: FakeS3Client
) -> Generator[TestClient, None, None]:
    """A TestClient whose requests use the test database and a fake S3."""

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_s3_client] = lambda: s3_stub
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
