import { createRoute } from "@tanstack/react-router";

import { rootRoute } from "@/app/routes";
import { LoginPage } from "./components/login-page";
import { ActivatePage } from "./components/activate-page";
import { ForgotPasswordPage } from "./components/forgot-password-page";
import { ResetPasswordPage } from "./components/reset-password-page";

// This feature's routes — mirrors the backend's auth/routes.py. Both render
// outside the app shell (see root-layout.tsx).
export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

export const activateRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activate",
  // The activation email links to /activate?token=<jwt>.
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: ActivatePage,
});

export const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  component: ForgotPasswordPage,
});

export const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password",
  // The reset email links to /reset-password?token=<jwt>.
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: ResetPasswordPage,
});
