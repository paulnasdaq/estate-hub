// Typed, centralized access to build-time environment (mirrors core/config.py).
// Vite only exposes vars prefixed with VITE_; keep all reads in this module so
// there is a single place that documents what the app expects.

export const config = {
  // Base URL for the API. Empty in dev — requests to /api are proxied to the
  // backend by Vite (see vite.config.ts). Set in production to the API origin.
  apiUrl: import.meta.env.VITE_API_URL ?? "",
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;
