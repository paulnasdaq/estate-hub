import { createRouter } from "@tanstack/react-router";

import { rootRoute } from "./routes";
import { dashboardIndexRoute } from "@/features/dashboard";
import {
  propertiesRoute,
  newPropertyRoute,
  propertyDetailsRoute,
  propertyEditRoute,
  propertyUnitsRoute,
  propertyNewUnitRoute,
  propertyUnitDetailRoute,
  propertyUnitEditRoute,
} from "@/features/properties";
import {
  organizationsRoute,
  newOrganizationRoute,
} from "@/features/organizations";
import { peopleRoute, newPersonRoute } from "@/features/people";
import {
  leasesRoute,
  newLeaseRoute,
  leaseDetailRoute,
} from "@/features/leases";
import { billsRoute, newBillRoute, billDetailRoute } from "@/features/bills";

// Aggregate every feature's routes under the root (mirrors backend app/api.py).
// Each feature owns its route definitions and exposes them through its barrel.
const routeTree = rootRoute.addChildren([
  dashboardIndexRoute,
  propertiesRoute,
  newPropertyRoute,
  propertyDetailsRoute,
  propertyEditRoute,
  propertyUnitsRoute,
  propertyNewUnitRoute,
  propertyUnitDetailRoute,
  propertyUnitEditRoute,
  organizationsRoute,
  newOrganizationRoute,
  peopleRoute,
  newPersonRoute,
  leasesRoute,
  newLeaseRoute,
  leaseDetailRoute,
  billsRoute,
  newBillRoute,
  billDetailRoute,
]);

export const router = createRouter({ routeTree });

// Register the router instance for full type-safety across the app.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
