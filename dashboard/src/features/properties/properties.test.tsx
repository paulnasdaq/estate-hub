import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { PropertiesPage } from "./components/properties-page";

// PropertiesPage links to the create page and each row links to its details,
// so it needs those routes registered in the test router.
const renderPage = () =>
  renderWithRouter(<PropertiesPage />, {
    initialPath: "/properties",
    linkPaths: ["/properties/new", "/properties/$propertyId"],
  });

describe("PropertiesPage", () => {
  test("renders the properties returned by the API", async () => {
    // Uses the default handler in test/msw/handlers.ts.
    renderPage();

    expect(await screen.findByText("Maple Court")).toBeInTheDocument();
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
});
