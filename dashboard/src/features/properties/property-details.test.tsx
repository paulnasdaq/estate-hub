import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { PropertyDetailsPage } from "./components/property-details-page";

const PROPERTY_ID = "22222222-2222-2222-2222-222222222222";

// PropertyDetailsPage links back to /properties, so it needs a router.
const renderPage = () =>
  renderWithRouter(<PropertyDetailsPage propertyId={PROPERTY_ID} />, {
    initialPath: "/properties/details",
    linkPaths: ["/properties"],
  });

describe("PropertyDetailsPage", () => {
  test("renders the property and resolves its organization name", async () => {
    // Uses the default get-by-id + organizations handlers.
    renderPage();

    expect(await screen.findByText("Acme Properties")).toBeInTheDocument();
    // The name appears in both the heading and the details grid.
    expect(screen.getAllByText("Maple Court").length).toBeGreaterThan(0);
    expect(screen.getByText("45.52")).toBeInTheDocument();
    expect(screen.getByText("-122.68")).toBeInTheDocument();
  });

  test("shows an error message when the request fails", async () => {
    server.use(
      http.get("*/api/v1/properties/:propertyId", () =>
        HttpResponse.json({ detail: "Property not found" }, { status: 404 }),
      ),
    );

    renderPage();

    expect(await screen.findByText("Property not found")).toBeInTheDocument();
  });
});
