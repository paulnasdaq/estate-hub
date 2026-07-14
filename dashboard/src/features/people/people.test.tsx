import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { PeoplePage } from "./components/people-page";

// PeoplePage links to /people/new, so it needs a router in tests.
const renderPage = () =>
  renderWithRouter(<PeoplePage />, {
    initialPath: "/people",
    linkPaths: ["/people/new"],
  });

describe("PeoplePage", () => {
  test("renders the people returned by the API", async () => {
    server.use(
      http.get("*/api/v1/users", () =>
        HttpResponse.json({
          items: [
            {
              id: "u1",
              created_at: "2026-01-01T00:00:00Z",
              first_name: "Ada",
              last_name: "Lovelace",
              email: "ada@example.com",
              phone: null,
              accounts: [],
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });

  test("shows an empty state when there are no people", async () => {
    // Uses the default handler (empty list) in test/msw/handlers.ts.
    renderPage();

    expect(await screen.findByText("No people yet")).toBeInTheDocument();
  });

  test("shows an error message when the request fails", async () => {
    server.use(
      http.get("*/api/v1/users", () =>
        HttpResponse.json({ detail: "Could not load people" }, { status: 500 }),
      ),
    );

    renderPage();

    expect(await screen.findByText("Could not load people")).toBeInTheDocument();
  });
});
