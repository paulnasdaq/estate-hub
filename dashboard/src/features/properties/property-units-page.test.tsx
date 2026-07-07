import { describe, expect, test } from "vitest";

import { renderWithRouter, screen } from "@/test/test-utils";
import { PropertyUnitsPage } from "./components/property-units-page";

const PROPERTY_ID = "22222222-2222-2222-2222-222222222222";

// PropertyUnitsPage links back to the property details page, so it needs a
// router with that route registered.
const renderPage = () =>
  renderWithRouter(<PropertyUnitsPage propertyId={PROPERTY_ID} />, {
    initialPath: "/properties/units",
    linkPaths: ["/properties/$propertyId"],
  });

describe("PropertyUnitsPage", () => {
  test("shows the property name and its units", async () => {
    // Uses the default get-by-id + nested-units handlers.
    renderPage();

    expect(await screen.findByText("Maple Court")).toBeInTheDocument();
    expect(await screen.findByText("Unit 1")).toBeInTheDocument();
  });

  test("links back to the property details page", async () => {
    renderPage();

    const backLink = await screen.findByRole("link", {
      name: /back to property/i,
    });
    expect(backLink).toHaveAttribute("href", `/properties/${PROPERTY_ID}`);
  });
});
