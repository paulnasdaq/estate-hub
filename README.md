# estate-hub

Backend for a property-management SaaS, built with **FastAPI**, **SQLAlchemy**,
and **Alembic**, using **PostgreSQL** in production.

## Features

- **Organizations** — tenant organizations with full CRUD under
  `/api/v1/organizations`.
- **Auth (RBAC)** — users, per-user accounts, roles, and permissions, joined via
  `user_roles` / `role_permissions`. Organization membership and roles attach to
  a user *account*, so one user can belong to multiple organizations.
- **Properties** — properties (name, coordinates, organization) and their units,
  under `/api/v1/properties` and `/api/v1/units`.

## Layout

The repository roots at the project; the application lives in [`backend/`](backend/).

```
.
├── backend/                 # FastAPI application (see backend/README.md)
├── docker-compose.dev.yml   # Postgres + hot-reloading backend
└── docker-compose.prod.yml  # Postgres + built image, migrations as an init job
```

Each backend feature is a self-contained package under `backend/app/` with its
own `models/`, `schemas/`, and `services/` packages plus routes.

## Quickstart (Docker)

```bash
docker compose -f docker-compose.dev.yml up --build
```

- API (v1): http://localhost:8000/api/v1
- Health: http://localhost:8000/health
- Interactive docs: http://localhost:8000/docs

A one-shot `migrate` service applies Alembic migrations before the backend
starts, so the schema is always current.

## Local development

See [`backend/README.md`](backend/README.md) for running the app with
[uv](https://docs.astral.sh/uv/), creating migrations, and linting.

## License

[MIT](LICENSE)
