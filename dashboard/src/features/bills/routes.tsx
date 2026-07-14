import { createRoute } from "@tanstack/react-router";

import { rootRoute } from "@/app/routes";
import { BillsPage } from "./components/bills-page";
import { NewBillPage } from "./components/new-bill-page";
import { BillDetailsPage } from "./components/bill-details-page";

// This feature's routes — mirrors the backend's billing/routes.py.
export const billsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bills",
  component: BillsPage,
});

export const newBillRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bills/new",
  component: NewBillPage,
});

// The details route keeps its page component prop-driven (and router-free for
// tests) by reading the path param here and passing it down.
export const billDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/bills/$billId",
  component: BillDetailRouteComponent,
});

function BillDetailRouteComponent() {
  const { billId } = billDetailRoute.useParams();
  return <BillDetailsPage billId={billId} />;
}
