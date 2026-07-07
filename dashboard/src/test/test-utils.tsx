import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { render, type RenderOptions } from "@testing-library/react";
import { useState, type ReactElement, type ReactNode } from "react";

// Custom render that wraps components in the app's global providers, so tests
// exercise the real Query cache + client (the analog of a shared conftest.py
// fixture). Retries are off so failed requests surface immediately in tests.
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function AllProviders({ children }: { children: ReactNode }) {
  const [client] = useState(createTestQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Renders a component that uses TanStack Router primitives (Link, useNavigate)
// inside a minimal in-memory router. `linkPaths` registers the routes the
// component links to so those links resolve; the component is mounted at
// `initialPath`.
function renderWithRouter(
  ui: ReactElement,
  {
    initialPath = "/",
    linkPaths = [],
  }: { initialPath?: string; linkPaths?: string[] } = {},
) {
  const rootRoute = createRootRoute();
  const uiRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: initialPath,
    component: () => ui,
  });
  const stubRoutes = linkPaths
    .filter((path) => path !== initialPath)
    .map((path) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path,
        component: () => null,
      }),
    );
  const router = createRouter({
    routeTree: rootRoute.addChildren([uiRoute, ...stubRoutes]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return customRender(<RouterProvider router={router} />);
}

// Re-export the Testing Library API, overriding `render` with the wrapped one.
export * from "@testing-library/react";
export { customRender as render, renderWithRouter };
