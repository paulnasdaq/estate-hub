import { createRoute } from "@tanstack/react-router";

import { rootRoute } from "@/app/routes";
import { PeoplePage } from "./components/people-page";
import { NewPersonPage } from "./components/new-person-page";
import { PersonDetailsPage } from "./components/person-details-page";

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

// The details route keeps its page component prop-driven (and router-free for
// tests) by reading the path param here and passing it down.
export const personDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/people/$personId",
  component: PersonDetailRouteComponent,
});

function PersonDetailRouteComponent() {
  const { personId } = personDetailRoute.useParams();
  return <PersonDetailsPage personId={personId} />;
}
