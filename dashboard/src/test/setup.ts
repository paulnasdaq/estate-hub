import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./msw/server";

// jsdom lacks a few DOM APIs that Radix UI primitives (Select, etc.) rely on.
// Polyfill them so those components are interactable in tests.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Runs before every test file (configured as setupFiles in vite.config.ts),
// mirroring conftest.py: start the mock API, reset handlers between tests so
// per-test overrides don't leak, and tear down at the end. `onUnhandledRequest:
// "error"` makes any un-mocked request fail loudly instead of hitting the network.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
