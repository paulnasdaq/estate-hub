import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test } from "vitest";

import { server } from "@/test/msw/server";
import { api, unwrap } from "./client";
import { refreshAccessToken, logout } from "./refresh";
import { clearAccessToken, getAccessToken, setAccessToken } from "./token";

const UNAUTHORIZED = {
  error: { code: "not_authenticated", message: "Not authenticated" },
};

beforeEach(() => clearAccessToken());

describe("refreshAccessToken", () => {
  test("stores the new token and returns true on success", async () => {
    server.use(
      http.post("*/api/v1/auth/refresh", () =>
        HttpResponse.json({ access_token: "fresh", token_type: "bearer" }),
      ),
    );

    await expect(refreshAccessToken()).resolves.toBe(true);
    expect(getAccessToken()).toBe("fresh");
  });

  test("clears the token and returns false when the cookie is rejected", async () => {
    setAccessToken("stale");
    server.use(
      http.post("*/api/v1/auth/refresh", () =>
        HttpResponse.json(UNAUTHORIZED, { status: 401 }),
      ),
    );

    await expect(refreshAccessToken()).resolves.toBe(false);
    expect(getAccessToken()).toBeNull();
  });
});

describe("logout", () => {
  test("calls the endpoint and clears the token", async () => {
    setAccessToken("x");
    let called = false;
    server.use(
      http.post("*/api/v1/auth/logout", () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await logout();

    expect(called).toBe(true);
    expect(getAccessToken()).toBeNull();
  });
});

describe("api client 401 handling", () => {
  test("refreshes once and replays the request on a 401", async () => {
    setAccessToken("expired");
    let attempts = 0;
    server.use(
      http.get("*/api/v1/organizations", () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json(UNAUTHORIZED, { status: 401 });
        }
        return HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 });
      }),
      http.post("*/api/v1/auth/refresh", () =>
        HttpResponse.json({ access_token: "fresh", token_type: "bearer" }),
      ),
    );

    const data = await unwrap(api.GET("/api/v1/organizations"));

    expect(data.total).toBe(0);
    expect(attempts).toBe(2); // original + one retry
    expect(getAccessToken()).toBe("fresh");
  });

  test("surfaces the 401 and clears the token when refresh fails", async () => {
    setAccessToken("expired");
    server.use(
      http.get("*/api/v1/organizations", () =>
        HttpResponse.json(UNAUTHORIZED, { status: 401 }),
      ),
      http.post("*/api/v1/auth/refresh", () =>
        HttpResponse.json(UNAUTHORIZED, { status: 401 }),
      ),
    );

    await expect(unwrap(api.GET("/api/v1/organizations"))).rejects.toBeDefined();
    expect(getAccessToken()).toBeNull();
  });
});
