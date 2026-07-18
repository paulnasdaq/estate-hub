import type { components } from "@/core/api/schema";

// Domain types sourced from the OpenAPI schema, so they stay in sync with the
// backend (regenerate with `npm run gen:api`).
export type LoginRequest = components["schemas"]["LoginRequest"];
export type ActivateRequest = components["schemas"]["ActivateRequest"];
export type ForgotPasswordRequest = components["schemas"]["ForgotPasswordRequest"];
export type ResetPasswordRequest = components["schemas"]["ResetPasswordRequest"];
export type TokenResponse = components["schemas"]["TokenResponse"];
