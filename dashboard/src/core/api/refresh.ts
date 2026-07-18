// Session lifecycle backed by the refresh-token cookie.
//
// These use the raw `fetch` (not the openapi `api` client) so this module has no
// dependency on client.ts — the client's 401 interceptor imports `refreshAccessToken`,
// and a cycle would break both. `credentials: "include"` makes the browser send
// and store the HttpOnly refresh cookie (needed when the API is cross-origin;
// harmless same-origin behind the dev proxy).

import { config } from "@/core/config";
import { clearAccessToken, setAccessToken } from "./token";

const REFRESH_URL = `${config.apiUrl}/api/v1/auth/refresh`;
const LOGOUT_URL = `${config.apiUrl}/api/v1/auth/logout`;

// Concurrent 401s (or a boot + a first query) must not each fire a refresh — the
// backend rotates the cookie, so a second in-flight refresh would replay the
// already-rotated token and trip reuse-detection. Share one in-flight request.
let inFlight: Promise<boolean> | null = null;

export function refreshAccessToken(): Promise<boolean> {
  inFlight ??= doRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doRefresh(): Promise<boolean> {
  try {
    const response = await fetch(REFRESH_URL, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      clearAccessToken();
      return false;
    }
    const { access_token } = (await response.json()) as { access_token: string };
    setAccessToken(access_token);
    return true;
  } catch {
    clearAccessToken();
    return false;
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(LOGOUT_URL, { method: "POST", credentials: "include" });
  } catch {
    // Best-effort: even if the request fails, drop the local token so the UI
    // treats the user as signed out.
  } finally {
    clearAccessToken();
  }
}
