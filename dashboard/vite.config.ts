/// <reference types="vitest/config" />
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    // Proxy API calls to the FastAPI backend during development so the
    // browser talks to a single origin (avoids CORS setup while developing).
    // The target is overridable so the dev server can reach the backend by its
    // Docker Compose service name (http://backend:8000) when containerized.
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Node's fetch can't parse relative URLs (the browser resolves them against
    // the origin). Give the client an absolute base so requests are parseable;
    // MSW intercepts them by path regardless of host.
    env: { VITE_API_URL: "http://localhost:8000" },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/**/*.d.ts"],
    },
  },
});
