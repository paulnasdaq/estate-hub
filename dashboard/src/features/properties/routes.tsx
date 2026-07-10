import { createRoute } from "@tanstack/react-router";

import { rootRoute } from "@/app/routes";
import { PropertiesPage } from "./components/properties-page";
import { NewPropertyPage } from "./components/new-property-page";
import { PropertyDetailsPage } from "./components/property-details-page";
import { EditPropertyPage } from "./components/edit-property-page";
import { PropertyUnitsPage } from "./components/property-units-page";
import { NewUnitPage } from "./components/new-unit-page";
import { UnitDetailsPage } from "./components/unit-details-page";
import { EditUnitPage } from "./components/edit-unit-page";

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

export const propertyEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/properties/$propertyId/edit",
  component: PropertyEditRouteComponent,
});

function PropertyEditRouteComponent() {
  const { propertyId } = propertyEditRoute.useParams();
  return <EditPropertyPage propertyId={propertyId} />;
}

export const propertyUnitsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/properties/$propertyId/units",
  component: PropertyUnitsRouteComponent,
});

function PropertyUnitsRouteComponent() {
  const { propertyId } = propertyUnitsRoute.useParams();
  return <PropertyUnitsPage propertyId={propertyId} />;
}

export const propertyNewUnitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/properties/$propertyId/units/new",
  component: PropertyNewUnitRouteComponent,
});

function PropertyNewUnitRouteComponent() {
  const { propertyId } = propertyNewUnitRoute.useParams();
  return <NewUnitPage propertyId={propertyId} />;
}

export const propertyUnitDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/properties/$propertyId/units/$unitId",
  component: PropertyUnitDetailRouteComponent,
});

function PropertyUnitDetailRouteComponent() {
  const { propertyId, unitId } = propertyUnitDetailRoute.useParams();
  return <UnitDetailsPage propertyId={propertyId} unitId={unitId} />;
}

export const propertyUnitEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/properties/$propertyId/units/$unitId/edit",
  component: PropertyUnitEditRouteComponent,
});

function PropertyUnitEditRouteComponent() {
  const { propertyId, unitId } = propertyUnitEditRoute.useParams();
  return <EditUnitPage propertyId={propertyId} unitId={unitId} />;
}
