import uuid

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings
from app.core.logging import request_id_ctx

REQUEST_ID_HEADER = "X-Request-ID"


def add_cors_middleware(app: FastAPI) -> None:
    """Enable credentialed CORS for the configured cross-origin dashboards.

    A no-op when ``cors_origins`` is empty (same-origin deployment, no CORS
    headers needed). Credentials are allowed so the refresh cookie can flow on
    /auth/refresh and /auth/logout; the CORS spec forbids the "*" origin wildcard
    together with credentials, so ``cors_origins`` must list each origin exactly.
    """
    if not settings.cors_origins:
        return
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Assigns a request id (from the inbound header or a fresh uuid), exposes
    it to logging via a contextvar, and echoes it on the response."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER) or str(uuid.uuid4())
        token = request_id_ctx.set(request_id)
        try:
            response = await call_next(request)
        finally:
            request_id_ctx.reset(token)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
