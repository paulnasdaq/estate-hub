from fastapi import Query

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


class PaginationParams:
    """Shared limit/offset query parameters for list endpoints."""

    def __init__(
        self,
        limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
        offset: int = Query(0, ge=0),
    ) -> None:
        self.limit = limit
        self.offset = offset
