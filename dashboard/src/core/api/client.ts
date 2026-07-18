import createClient, { type Middleware } from "openapi-fetch";
import { config } from "@/core/config";
import type { paths } from "./schema";
import { clearAccessToken, getAccessToken } from "./token";
import { refreshAccessToken } from "./refresh";

// A 401 on an auth endpoint is meaningful (bad credentials / expired refresh) and
// must not trigger a refresh-retry loop.
function isAuthRequest(url: string): boolean {
  return url.includes("/api/v1/auth/");
}

// A Request's body is consumed once it's fetched, so to retry after refreshing we
// stash a pre-send clone keyed by the original request.
const retryClones = new WeakMap<Request, Request>();

// Attaches the bearer token to every request, and transparently recovers from an
// expired access token: on a 401, refresh once (shared across concurrent calls)
// and replay the original request with the new token.
const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = getAccessToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    try {
      retryClones.set(request, request.clone());
    } catch {
      // A body that can't be cloned simply won't be auto-retried.
    }
    return request;
  },

  async onResponse({ request, response }) {
    if (response.status !== 401 || isAuthRequest(request.url)) {
      return response;
    }
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      clearAccessToken();
      return response;
    }
    const retry = retryClones.get(request);
    if (!retry) {
      return response;
    }
    retry.headers.set("Authorization", `Bearer ${getAccessToken()}`);
    // Replay via the raw fetch so it isn't re-intercepted (no recursion).
    return globalThis.fetch(retry);
  },
};

// Empty base URL in dev so requests go to the same origin and are proxied to
// FastAPI by Vite; set VITE_API_URL in production (see core/config.ts).
export const api = createClient<paths>({
  baseUrl: config.apiUrl,
  // Resolve the global fetch per-request instead of capturing it at creation.
  // This client is created at import time; test tools (MSW) patch globalThis
  // .fetch later, and a captured reference would bypass that patch.
  fetch: (...args) => globalThis.fetch(...args),
});

api.use(authMiddleware);

// openapi-fetch returns `{ data, error }` instead of throwing. This unwraps that
// for use in query/mutation functions: it throws on an API error, and also when
// the response carries neither data nor a parseable error (e.g. the backend is
// unreachable and the dev proxy returns a bare 5xx) — otherwise the query would
// silently "succeed" with undefined data and never show an error state.
export async function unwrap<T>(
  result: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await result;
  if (error !== undefined) throw error;
  if (data === undefined) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return data;
}
