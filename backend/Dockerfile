# syntax=docker/dockerfile:1

# ---- builder: resolve and install dependencies with uv ----
FROM python:3.12-slim AS builder

# Bring in the uv binary (pinned for reproducible builds).
COPY --from=ghcr.io/astral-sh/uv:0.11.16 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /app

# Install third-party deps first (without the project) for better layer caching.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

# Then install the project itself.
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev


# ---- runtime ----
FROM python:3.12-slim AS runtime

# Run as an unprivileged user.
RUN groupadd --system app \
    && useradd --system --gid app --create-home --home-dir /home/app app

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# The virtualenv lives outside /app so a dev bind-mount of the source
# (docker-compose.dev.yml) does not shadow it.
COPY --from=builder --chown=app:app /opt/venv /opt/venv
COPY --from=builder --chown=app:app /app /app

USER app

EXPOSE 8000

# Production default; docker-compose.dev.yml overrides this with `fastapi dev`.
CMD ["fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8000"]
