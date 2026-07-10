import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { PropertyUnits } from "./components/property-units";

const PROPERTY_ID = "22222222-2222-2222-2222-222222222222";
const UNIT_ID = "55555555-5555-5555-5555-555555555555";

function unitItem(id: string, name: string, price = 1200) {
  return {
    id,
    created_at: "2026-01-01T00:00:00Z",
    name,
    price,
    property_id: PROPERTY_ID,
  };
}

// Each unit row links to the unit detail page, so the list needs a router with
// that route registered.
const renderUnits = () =>
  renderWithRouter(<PropertyUnits propertyId={PROPERTY_ID} />, {
    initialPath: "/properties/units",
    linkPaths: ["/properties/$propertyId/units/$unitId"],
  });

describe("PropertyUnits", () => {
  test("lists the property's units, linking each to its detail page", async () => {
    // Uses the default nested-units handler (a single "Unit 1").
    renderUnits();

    const row = await screen.findByRole("link", { name: /Unit 1/ });
    expect(row).toHaveAttribute(
      "href",
      `/properties/${PROPERTY_ID}/units/${UNIT_ID}`,
    );
    // Price (1200) is rendered as formatted currency.
    expect(screen.getByText("$1,200")).toBeInTheDocument();
  });

  test("shows an empty state when there are no units", async () => {
    server.use(
      http.get("*/api/v1/properties/:propertyId/units", () =>
        HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
      ),
    );

    renderUnits();

    expect(await screen.findByText("No units yet.")).toBeInTheDocument();
  });

  test("sends the debounced search term to the API and shows a no-match state", async () => {
    let lastSearch: string | null = null;
    server.use(
      http.get("*/api/v1/properties/:propertyId/units", ({ request }) => {
        lastSearch = new URL(request.url).searchParams.get("search");
        return HttpResponse.json({
          items: lastSearch ? [] : [unitItem(UNIT_ID, "Unit 1")],
          total: 0,
          limit: 10,
          offset: 0,
        });
      }),
    );

    const user = userEvent.setup();
    renderUnits();

    // Wait for the initial render (the router mounts asynchronously) before
    // interacting with the search box.
    const input = await screen.findByLabelText("Search units by name");
    await user.type(input, "penthouse");

    await waitFor(() => expect(lastSearch).toBe("penthouse"));
    expect(
      await screen.findByText("No units match “penthouse”."),
    ).toBeInTheDocument();
  });

  test("pages through units by offset", async () => {
    // 10 rows per page; the server pages by the offset query.
    server.use(
      http.get("*/api/v1/properties/:propertyId/units", ({ request }) => {
        const offset = Number(
          new URL(request.url).searchParams.get("offset") ?? "0",
        );
        const index = offset === 0 ? 0 : 1;
        return HttpResponse.json({
          items: [unitItem(`unit-${index}`, `Unit page ${index}`)],
          total: 11, // spills onto a second page (page size is 10)
          limit: 10,
          offset,
        });
      }),
    );

    const user = userEvent.setup();
    renderUnits();

    expect(await screen.findByText("Unit page 0")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(await screen.findByText("Unit page 1")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled(),
    );
  });
});
