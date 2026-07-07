import { createRootRoute } from "@tanstack/react-router";

import { RootLayout } from "@/components/layout/root-layout";

// The root route renders the app shell (sidebar + header). Every feature route
// attaches to this via `getParentRoute: () => rootRoute`.
export const rootRoute = createRootRoute({ component: RootLayout });
