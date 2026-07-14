import { createRoute } from "@tanstack/react-router";

import { rootRoute } from "@/app/routes";
import { PeoplePage } from "./components/people-page";
import { NewPersonPage } from "./components/new-person-page";

// This feature's routes — backed by the backend's users resource
// (app/auth/routes.py), surfaced in the dashboard as "People".
export const peopleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/people",
  component: PeoplePage,
});

export const newPersonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/people/new",
  component: NewPersonPage,
});
