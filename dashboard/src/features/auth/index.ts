// Public API of the auth feature (mirrors a feature's __init__.py). Other parts
// of the app import from here — never from deep internal paths.
export {
  loginRoute,
  activateRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
} from "./routes";
export { LoginPage } from "./components/login-page";
export { LoginForm } from "./components/login-form";
export { ActivatePage } from "./components/activate-page";
export { ActivateForm } from "./components/activate-form";
export { ForgotPasswordPage } from "./components/forgot-password-page";
export { ForgotPasswordForm } from "./components/forgot-password-form";
export { ResetPasswordPage } from "./components/reset-password-page";
export { ResetPasswordForm } from "./components/reset-password-form";
export {
  useLogin,
  useActivate,
  useForgotPassword,
  useResetPassword,
} from "./api/auth.queries";
export {
  loginFormSchema,
  activateFormSchema,
  forgotPasswordFormSchema,
  resetPasswordFormSchema,
  type LoginFormValues,
  type ActivateFormValues,
  type ForgotPasswordFormValues,
  type ResetPasswordFormValues,
} from "./schemas";
export type {
  LoginRequest,
  ActivateRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  TokenResponse,
} from "./types";
