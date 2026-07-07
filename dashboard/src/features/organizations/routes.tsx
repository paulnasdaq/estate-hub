import { createRoute } from "@tanstack/react-router";

import { rootRoute } from "@/app/routes";
import { OrganizationsPage } from "./components/organizations-page";
import { NewOrganizationPage } from "./components/new-organization-page";

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
