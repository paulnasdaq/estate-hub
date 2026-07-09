"""S3 client factory.

Credentials and the target bucket come from :mod:`app.core.config`; pointing
``s3_endpoint_url`` at MinIO/LocalStack makes the same client work in
development. Consumers (e.g. MediaService) own the actual object operations.
"""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

import boto3

from app.core.config import settings

if TYPE_CHECKING:
    from mypy_boto3_s3.client import S3Client


@lru_cache(maxsize=1)
def get_s3_client() -> S3Client:
    """Build a process-wide S3 client from settings.

    Cached because boto3 clients are relatively expensive to construct and are
    safe to share across threads. Also serves as the FastAPI dependency, so
    tests can override it with a stub client.
    """
    return boto3.client(
        "s3",
        config=boto3.session.Config(signature_version="s3v4"),
        region_name=settings.s3_region,
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
    )
