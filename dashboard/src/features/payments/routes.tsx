import { createRoute } from "@tanstack/react-router";

import { rootRoute } from "@/app/routes";
import { PaymentsPage } from "./components/payments-page";

// This feature's routes — mirrors the backend's payments/routes.py.
export const paymentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/payments",
  component: PaymentsPage,
});
