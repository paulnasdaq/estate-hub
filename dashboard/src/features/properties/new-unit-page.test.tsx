import { describe, expect, test } from "vitest";

import { renderWithRouter, screen } from "@/test/test-utils";
import { NewUnitPage } from "./components/new-unit-page";

const PROPERTY_ID = "22222222-2222-2222-2222-222222222222";

// NewUnitPage links back to the property's units list, so it needs a router
// with that route registered.
const renderPage = () =>
  renderWithRouter(<NewUnitPage propertyId={PROPERTY_ID} />, {
    initialPath: "/properties/units/new",
    linkPaths: ["/properties/$propertyId/units"],
  });

describe("NewUnitPage", () => {
  test("shows the property name and a unit form", async () => {
    renderPage();

    expect(
      await screen.findByText(/adding a unit to maple court/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Price")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add unit/i }),
    ).toBeInTheDocument();
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
});
