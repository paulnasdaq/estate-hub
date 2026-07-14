import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { SAMPLE_ORG_ID } from "@/test/msw/handlers";
import { PropertiesPage } from "./components/properties-page";

const now = "2026-01-01T00:00:00Z";

function makeProperty(id: string, name: string) {
  return {
    id,
    created_at: now,
    name,
    lat: 45.52,
    lng: -122.68,
    organization_id: SAMPLE_ORG_ID,
    unit_count: 4,
    occupied_unit_count: 1,
  };
}

// PropertiesPage links to the create page and each row links to its details,
// so it needs those routes registered in the test router.
const renderPage = () =>
  renderWithRouter(<PropertiesPage />, {
    initialPath: "/properties",
    linkPaths: ["/properties/new", "/properties/$propertyId"],
  });

describe("PropertiesPage", () => {
  test("renders the properties returned by the API", async () => {
    // Uses the default handler in test/msw/handlers.ts (3 units, 2 occupied).
    renderPage();

    expect(await screen.findByText("Maple Court")).toBeInTheDocument();
    // Occupancy is rendered as "occupied / total".
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  test("shows an error message when the request fails", async () => {
    server.use(
      http.get("*/api/v1/properties", () =>
        HttpResponse.json(
          { detail: "Could not load properties" },
          { status: 500 },
        ),
      ),
    );

    renderPage();

    expect(
      await screen.findByText("Could not load properties"),
    ).toBeInTheDocument();
  });

  test("filters the list via the search box", async () => {
    const user = userEvent.setup();
    const all = [
      makeProperty("1", "Maple Court"),
      makeProperty("2", "Oak Ridge"),
    ];
    // Server-side search: the handler filters by the ?search query param, so
    // this asserts the box actually sends it (not just client-side filtering).
    server.use(
      http.get("*/api/v1/properties", ({ request }) => {
        const term = new URL(request.url).searchParams
          .get("search")
          ?.toLowerCase();
        const items = term
          ? all.filter((p) => p.name.toLowerCase().includes(term))
          : all;
        return HttpResponse.json({
          items,
          total: items.length,
          limit: 50,
          offset: 0,
        });
      }),
    );

    renderPage();
    expect(await screen.findByText("Maple Court")).toBeInTheDocument();
    expect(screen.getByText("Oak Ridge")).toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Search properties by name"),
      "oak",
    );

    expect(await screen.findByText("Oak Ridge")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText("Maple Court")).not.toBeInTheDocument(),
    );
  });

  test("pages through the list by offset", async () => {
    const user = userEvent.setup();
    // 10 rows per page; page 2 holds a single extra row.
    server.use(
      http.get("*/api/v1/properties", ({ request }) => {
        const offset = Number(
          new URL(request.url).searchParams.get("offset") ?? "0",
        );
        const items =
          offset === 0
            ? [makeProperty("1", "Page One Place")]
            : [makeProperty("2", "Page Two Place")];
        return HttpResponse.json({ items, total: 11, limit: 10, offset });
      }),
    );

    renderPage();

    expect(await screen.findByText("Page One Place")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(await screen.findByText("Page Two Place")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled(),
    );
  });

  test("shows an empty state when a search matches nothing", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("*/api/v1/properties", () =>
        HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
      ),
    );

    renderPage();

    // findBy waits for the router to mount the page before querying.
    await user.type(
      await screen.findByLabelText("Search properties by name"),
      "zzz",
    );

    expect(await screen.findByText(/No properties match/)).toBeInTheDocument();
  });
});
