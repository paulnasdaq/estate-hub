import { createRootRoute, redirect } from "@tanstack/react-router";

import { RootLayout } from "@/components/layout/root-layout";
import { getAccessToken } from "@/core/api/token";
import { refreshAccessToken } from "@/core/api/refresh";

// Routes reachable without an access token: the login screen and the emailed
// activation link. Everything else requires authentication (see beforeLoad).
const PUBLIC_PATHS = [
  "/login",
  "/activate",
  "/forgot-password",
  "/reset-password",
];

// The root route renders the app shell (sidebar + header). Every feature route
// attaches to this via `getParentRoute: () => rootRoute`.
export const rootRoute = createRootRoute({
  component: RootLayout,
  // Global auth guard. The access token lives in memory, so on a fresh load (or
  // after it expires) it's absent — before redirecting, try to rehydrate the
  // session from the HttpOnly refresh cookie. This is what keeps a hard reload
  // from bouncing an otherwise-signed-in user to /login.
  beforeLoad: async ({ location }) => {
    if (PUBLIC_PATHS.includes(location.pathname)) return;
    if (getAccessToken()) return;
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      throw redirect({ to: "/login" });
    }
  },
});
