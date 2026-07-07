import { createRouter } from "@tanstack/react-router";

import { rootRoute } from "./routes";
import { dashboardIndexRoute } from "@/features/dashboard";
import { propertiesRoute, newPropertyRoute } from "@/features/properties";

// Aggregate every feature's routes under the root (mirrors backend app/api.py).
// Each feature owns its route definitions and exposes them through its barrel.
const routeTree = rootRoute.addChildren([
  dashboardIndexRoute,
  propertiesRoute,
  newPropertyRoute,
]);

export const router = createRouter({ routeTree });

// Register the router instance for full type-safety across the app.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
