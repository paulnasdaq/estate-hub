import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings, settings
from app.core.middleware import add_cors_middleware

ORIGIN = "https://app.example.com"


def _app_with_cors() -> TestClient:
    app = FastAPI()

    @app.get("/ping")
    def ping() -> dict[str, bool]:
        return {"ok": True}

    add_cors_middleware(app)
    return TestClient(app)


def test_no_cors_headers_when_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "cors_origins", [])
    client = _app_with_cors()

    resp = client.get("/ping", headers={"Origin": ORIGIN})

    assert resp.status_code == 200
    assert "access-control-allow-origin" not in resp.headers


def test_allows_configured_origin_with_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "cors_origins", [ORIGIN])
    client = _app_with_cors()

    resp = client.get("/ping", headers={"Origin": ORIGIN})

    assert resp.headers["access-control-allow-origin"] == ORIGIN
    assert resp.headers["access-control-allow-credentials"] == "true"


def test_preflight_is_answered(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "cors_origins", [ORIGIN])
    client = _app_with_cors()

    resp = client.options(
        "/ping",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
        },
    )

    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == ORIGIN
    assert resp.headers["access-control-allow-credentials"] == "true"


def test_unlisted_origin_is_not_allowed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "cors_origins", [ORIGIN])
    client = _app_with_cors()

    resp = client.get("/ping", headers={"Origin": "https://evil.example.com"})

    # The browser blocks it: no allow-origin header echoing the caller.
    assert resp.headers.get("access-control-allow-origin") != "https://evil.example.com"


def test_cors_origins_accepts_comma_separated_string() -> None:
    parsed = Settings(cors_origins="https://a.example.com, https://b.example.com")
    assert parsed.cors_origins == ["https://a.example.com", "https://b.example.com"]
