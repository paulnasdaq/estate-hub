import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { LeasesPage } from "./components/leases-page";

const now = "2026-01-01T00:00:00Z";

function makeLease(id: string, effectiveFrom: string) {
  return {
    id,
    created_at: now,
    unit_id: "22222222-2222-2222-2222-222222222222",
    account_id: "33333333-3333-3333-3333-333333333333",
    effective_from: effectiveFrom,
    terminated_on: null,
  };
}

const renderPage = () =>
  renderWithRouter(<LeasesPage />, { initialPath: "/leases" });

describe("LeasesPage", () => {
  test("renders the leases returned by the API", async () => {
    server.use(
      http.get("*/api/v1/leases", () =>
        HttpResponse.json({
          items: [makeLease("1", "2026-02-01T00:00:00Z")],
          total: 1,
          limit: 10,
          offset: 0,
        }),
      ),
    );

    renderPage();

    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Leases" }),
    ).toBeInTheDocument();
  });

  test("shows an error message when the request fails", async () => {
    server.use(
      http.get("*/api/v1/leases", () =>
        HttpResponse.json({ detail: "Could not load leases" }, { status: 500 }),
      ),
    );

    renderPage();

    expect(
      await screen.findByText("Could not load leases"),
    ).toBeInTheDocument();
  });

  test("pages through the list by offset", async () => {
    const user = userEvent.setup();
    // 10 rows per page; page 2 holds a single extra row.
    server.use(
      http.get("*/api/v1/leases", ({ request }) => {
        const offset = Number(
          new URL(request.url).searchParams.get("offset") ?? "0",
        );
        const items =
          offset === 0
            ? [makeLease("1", "2026-02-01T00:00:00Z")]
            : [makeLease("2", "2026-03-01T00:00:00Z")];
        return HttpResponse.json({ items, total: 11, limit: 10, offset });
      }),
    );

    renderPage();

    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled(),
    );
  });

  test("shows an empty state when there are no leases", async () => {
    server.use(
      http.get("*/api/v1/leases", () =>
        HttpResponse.json({ items: [], total: 0, limit: 10, offset: 0 }),
      ),
    );

    renderPage();

    expect(await screen.findByText("No leases yet")).toBeInTheDocument();
  });
});
