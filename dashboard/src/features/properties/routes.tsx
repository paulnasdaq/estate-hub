import { createRoute } from "@tanstack/react-router";

import { rootRoute } from "@/app/routes";
import { PropertiesPage } from "./components/properties-page";
import { NewPropertyPage } from "./components/new-property-page";

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
