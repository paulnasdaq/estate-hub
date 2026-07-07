import { createRoute } from "@tanstack/react-router";

import { rootRoute } from "@/app/routes";
import { OverviewPage } from "./components/overview-page";

// The index route ("/") — the dashboard overview (mirrors a feature's routes.py).
export const dashboardIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: OverviewPage,
});
