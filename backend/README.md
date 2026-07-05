# backend

FastAPI backend with SQLAlchemy, managed with [uv](https://docs.astral.sh/uv/).

## Setup

```bash
uv sync
```

## Run the dev server

```bash
uv run fastapi dev app/main.py
```

- Health check: http://127.0.0.1:8000/health
- API (v1): http://127.0.0.1:8000/api/v1/organizations
- Interactive docs: http://127.0.0.1:8000/docs

## Database migrations (Alembic)

The schema is managed by Alembic (config in `alembic.ini`, environment in
`alembic/env.py`, which reads the URL and models from the app).

```bash
uv run alembic upgrade head                              # apply all migrations
uv run alembic revision --autogenerate -m "add x table"  # generate a migration
uv run alembic downgrade -1                              # roll back one revision
uv run alembic current                                   # show applied revision
```

After changing a feature's `models.py`, autogenerate a new revision and review it
before applying. Apply migrations before starting the server on a fresh database.
Type changes are detected (`compare_type=True`).

## Lint & format (ruff)

```bash
uv run ruff check .          # lint
uv run ruff check --fix .    # lint + autofix
uv run ruff format .         # format
```

## Configuration

Settings are read from environment variables or a `.env` file (see
`app/core/config.py`); copy `.env.example` to `.env` to start. Key settings:
`ENVIRONMENT` (`local`/`test`/`staging`/`production`), `LOG_LEVEL`, `DATABASE_URL`
(defaults to SQLite `app.db`). Do not commit real secrets.

## Cross-cutting behavior

- **API versioning** — all feature routers are aggregated under `/api/v1` in
  `app/api.py`.
- **Error envelope** — every error returns `{"error": {code, message,
  request_id, details?}}` (see `app/core/exceptions.py`). Domain errors subclass
  `AppError` (e.g. `NotFoundError`, `ConflictError`).
- **Pagination** — list endpoints take `limit`/`offset` and return a
  `Page` envelope `{items, total, limit, offset}` (`app/core/pagination.py`,
  `app/core/schemas.py`).
- **Request IDs & logging** — `RequestIdMiddleware` assigns/echoes an
  `X-Request-ID` header and threads it into every log line.
- **Base read schema** — `TimestampedRead` exposes `id`/`created_at`/`deleted_at`
  for all feature read models.

## Project layout

The app uses a **feature-folder (vertical slice)** layout: shared infrastructure
lives in `app/core/`, and each feature is a self-contained package under `app/`.

```
app/
├── main.py            # app wiring: logging, middleware, handlers, routers
├── api.py             # aggregates feature routers under /api/v1
├── registry.py        # imports all feature models for Alembic
├── core/              # ── shared infrastructure ──
│   ├── config.py         # Pydantic settings
│   ├── database.py       # engine, session, Base (id/created_at/deleted_at), get_db
│   ├── schemas.py        # ORMModel, TimestampedRead, Page[T]
│   ├── pagination.py     # PaginationParams (limit/offset)
│   ├── exceptions.py     # AppError hierarchy + error-envelope handlers
│   ├── logging.py        # structured logging + request-id contextvar
│   └── middleware.py     # RequestIdMiddleware
└── organizations/     # ── feature ──
    ├── models.py
    ├── schemas.py
    ├── exceptions.py
    ├── services.py       # business logic (no HTTP concerns)
    ├── dependencies.py   # get_organization_or_404
    ├── routes.py         # thin APIRouter; delegates to services
    └── tests/
conftest.py            # shared pytest fixtures (client, db_session)
alembic/               # migration environment (env.py wired to settings + registry)
```

New feature checklist: create `app/<feature>/` with the files above, import its
models in `app/registry.py`, and include its router in `app/api.py`.

## Tests

```bash
uv run pytest
```
