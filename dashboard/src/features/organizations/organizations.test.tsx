import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { OrganizationsPage } from "./components/organizations-page";

// OrganizationsPage links to /organizations/new, so it needs a router in tests.
const renderPage = () =>
  renderWithRouter(<OrganizationsPage />, {
    initialPath: "/organizations",
    linkPaths: ["/organizations/new"],
  });

describe("OrganizationsPage", () => {
  test("renders the organizations returned by the API", async () => {
    // Uses the default handler in test/msw/handlers.ts.
    renderPage();

    expect(await screen.findByText("Acme Properties")).toBeInTheDocument();
  });

  test("shows an error message when the request fails", async () => {
    server.use(
      http.get("*/api/v1/organizations", () =>
        HttpResponse.json(
          { detail: "Could not load organizations" },
          { status: 500 },
        ),
      ),
    );

    renderPage();

    expect(
      await screen.findByText("Could not load organizations"),
    ).toBeInTheDocument();
  });
});
