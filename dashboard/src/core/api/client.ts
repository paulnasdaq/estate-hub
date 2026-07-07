import createClient, { type Middleware } from "openapi-fetch";
import { config } from "@/core/config";
import type { paths } from "./schema";
import { getAccessToken } from "./token";

// Attaches the bearer token (when present) to every outgoing request.
const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = getAccessToken();
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`);
    }
    return request;
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
