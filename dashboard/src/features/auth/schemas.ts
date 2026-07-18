import { z } from "zod";

// Form validation for signing in (the client-side analog of the backend's
// Pydantic LoginRequest).
export const loginFormSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

// A password + confirmation, shared by the activation and password-reset forms.
// The minimum length mirrors the backend (>= 8 chars); the confirm field is
// client-only.
const passwordWithConfirm = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const activateFormSchema = passwordWithConfirm;
export type ActivateFormValues = z.infer<typeof activateFormSchema>;

export const resetPasswordFormSchema = passwordWithConfirm;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

// Form validation for requesting a password-reset email.
export const forgotPasswordFormSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;
