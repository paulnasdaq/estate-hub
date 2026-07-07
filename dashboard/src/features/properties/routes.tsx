import { createRoute } from "@tanstack/react-router";

import { rootRoute } from "@/app/routes";
import { PropertiesPage } from "./components/properties-page";
import { NewPropertyPage } from "./components/new-property-page";
import { PropertyDetailsPage } from "./components/property-details-page";

// This feature's routes — mirrors the backend's properties/routes.py.
export const propertiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/properties",
  component: PropertiesPage,
});

export const newPropertyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/properties/new",
  component: NewPropertyPage,
});

// The details route keeps its page component prop-driven (and router-free for
// tests) by reading the path param here and passing it down.
export const propertyDetailsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/properties/$propertyId",
  component: PropertyDetailsRouteComponent,
});

function PropertyDetailsRouteComponent() {
  const { propertyId } = propertyDetailsRoute.useParams();
  return <PropertyDetailsPage propertyId={propertyId} />;
}
