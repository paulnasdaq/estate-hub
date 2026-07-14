import { createRoute } from "@tanstack/react-router";

import { rootRoute } from "@/app/routes";
import { LeasesPage } from "./components/leases-page";
import { NewLeasePage } from "./components/new-lease-page";
import { LeaseDetailsPage } from "./components/lease-details-page";

// This feature's routes — mirrors the backend's leases/routes.py.
export const leasesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leases",
  component: LeasesPage,
});

export const newLeaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leases/new",
  component: NewLeasePage,
});

// The details route keeps its page component prop-driven (and router-free for
// tests) by reading the path param here and passing it down.
export const leaseDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leases/$leaseId",
  component: LeaseDetailRouteComponent,
});

function LeaseDetailRouteComponent() {
  const { leaseId } = leaseDetailRoute.useParams();
  return <LeaseDetailsPage leaseId={leaseId} />;
}
