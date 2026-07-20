import { createRoute } from "@tanstack/react-router";

import { rootRoute } from "@/app/routes";
import { OrganizationsPage } from "./components/organizations-page";
import { NewOrganizationPage } from "./components/new-organization-page";
import { OrganizationDetailsPage } from "./components/organization-details-page";
import { EditOrganizationPage } from "./components/edit-organization-page";

// This feature's routes — mirrors the backend's organizations/routes.py.
export const organizationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organizations",
  component: OrganizationsPage,
});

export const newOrganizationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organizations/new",
  component: NewOrganizationPage,
});

// The details route keeps its page component prop-driven (and router-free for
// tests) by reading the path param here and passing it down.
export const organizationDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organizations/$orgId",
  component: OrganizationDetailRouteComponent,
});

function OrganizationDetailRouteComponent() {
  const { orgId } = organizationDetailRoute.useParams();
  return <OrganizationDetailsPage orgId={orgId} />;
}

export const organizationEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/organizations/$orgId/edit",
  component: OrganizationEditRouteComponent,
});

function OrganizationEditRouteComponent() {
  const { orgId } = organizationEditRoute.useParams();
  return <EditOrganizationPage orgId={orgId} />;
}
