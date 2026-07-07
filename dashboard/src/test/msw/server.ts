import { setupServer } from "msw/node";

import { handlers } from "./handlers";

// The mock API server used across the test suite (the analog of the backend's
// test-DB fixtures in conftest.py). Lifecycle is managed in test/setup.ts.
export const server = setupServer(...handlers);
