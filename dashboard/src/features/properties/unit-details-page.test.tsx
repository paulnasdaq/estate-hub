import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { UnitDetailsPage } from "./components/unit-details-page";

const PROPERTY_ID = "22222222-2222-2222-2222-222222222222";
const UNIT_ID = "55555555-5555-5555-5555-555555555555";

// UnitDetailsPage links back to the property's units list, so it needs a router
// with that route registered.
const renderPage = () =>
  renderWithRouter(
    <UnitDetailsPage propertyId={PROPERTY_ID} unitId={UNIT_ID} />,
    {
      initialPath: "/properties/units/detail",
      linkPaths: [
        "/properties/$propertyId/units",
        "/properties/$propertyId/units/$unitId/edit",
      ],
    },
  );

describe("UnitDetailsPage", () => {
  test("shows the unit name, price, and a media section", async () => {
    // Uses the default get-unit + empty unit-media handlers.
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Unit 1" }),
    ).toBeInTheDocument();
    expect(screen.getByText("$1,200")).toBeInTheDocument();
    // The media section renders (empty by default).
    expect(await screen.findByText("No media yet.")).toBeInTheDocument();
    expect(
      screen.getByText("Photos and documents for this unit."),
    ).toBeInTheDocument();
  });

  test("renders the unit's media from the unit endpoint", async () => {
    server.use(
      http.get("*/api/v1/units/:unitId/media", () =>
        HttpResponse.json({
          items: [
            {
              id: "unit-img-1",
              created_at: "2026-01-01T00:00:00Z",
              deleted_at: null,
              entity_type: "unit",
              entity_id: UNIT_ID,
              content_type: "image/jpeg",
              size_bytes: 1024,
              is_primary: true,
              display_order: 0,
              storage_key: `units/${UNIT_ID}/images/bedroom.jpg`,
              url: "http://s3.test/bedroom.jpg",
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
    );

    renderPage();

    const img = await screen.findByRole("img", { name: "bedroom.jpg" });
    expect(img).toHaveAttribute("src", "http://s3.test/bedroom.jpg");
  });

  test("links back to the property's units list", async () => {
    renderPage();

    const backLink = await screen.findByRole("link", {
      name: /back to units/i,
    });
    expect(backLink).toHaveAttribute(
      "href",
      `/properties/${PROPERTY_ID}/units`,
    );
  });

  test("links to the unit edit page", async () => {
    renderPage();

    const editLink = await screen.findByRole("link", { name: /edit/i });
    expect(editLink).toHaveAttribute(
      "href",
      `/properties/${PROPERTY_ID}/units/${UNIT_ID}/edit`,
    );
  });
});
