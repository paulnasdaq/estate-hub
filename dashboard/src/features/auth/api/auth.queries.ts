import { useMutation } from "@tanstack/react-query";

import { api, unwrap } from "@/core/api/client";
import { setAccessToken } from "@/core/api/token";
import type {
  ActivateRequest,
  ForgotPasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
} from "../types";

// Data access for the auth feature. Both endpoints return a login token, which
// we stash in the in-memory token store on success so subsequent requests are
// authenticated (see core/api/token.ts).

export function useLogin() {
  return useMutation({
    mutationFn: (body: LoginRequest) =>
      unwrap(api.POST("/api/v1/auth/login", { body })),
    onSuccess: (data) => setAccessToken(data.access_token),
  });
}

export function useActivate() {
  return useMutation({
    mutationFn: (body: ActivateRequest) =>
      unwrap(api.POST("/api/v1/auth/activate", { body })),
    onSuccess: (data) => setAccessToken(data.access_token),
  });
}

export function useForgotPassword() {
  return useMutation({
    // 204 No Content — nothing to unwrap; errors still surface via openapi-fetch.
    mutationFn: async (body: ForgotPasswordRequest) => {
      const { error } = await api.POST("/api/v1/auth/forgot-password", { body });
      if (error !== undefined) throw error;
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (body: ResetPasswordRequest) =>
      unwrap(api.POST("/api/v1/auth/reset-password", { body })),
    onSuccess: (data) => setAccessToken(data.access_token),
  });
}
