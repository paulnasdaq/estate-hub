import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { BillsPage } from "./components/bills-page";

const now = "2026-01-01T00:00:00Z";

function makeBill(id: string, date: string) {
  return {
    id,
    created_at: now,
    deleted_at: null,
    lease_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    date,
    items: [],
  };
}

const renderPage = () =>
  renderWithRouter(<BillsPage />, { initialPath: "/bills" });

describe("BillsPage", () => {
  test("renders the bills returned by the API", async () => {
    server.use(
      http.get("*/api/v1/bills", () =>
        HttpResponse.json({
          items: [makeBill("1", "2026-02-01")],
          total: 1,
          limit: 10,
          offset: 0,
        }),
      ),
    );

    renderPage();

    expect(
      await screen.findByText(new Date("2026-02-01").toLocaleDateString()),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bills" })).toBeInTheDocument();
  });

  test("shows an error message when the request fails", async () => {
    server.use(
      http.get("*/api/v1/bills", () =>
        HttpResponse.json({ detail: "Could not load bills" }, { status: 500 }),
      ),
    );

    renderPage();

    expect(await screen.findByText("Could not load bills")).toBeInTheDocument();
  });

  test("pages through the list by offset", async () => {
    const user = userEvent.setup();
    // 10 rows per page; page 2 holds a single extra row.
    server.use(
      http.get("*/api/v1/bills", ({ request }) => {
        const offset = Number(
          new URL(request.url).searchParams.get("offset") ?? "0",
        );
        const items =
          offset === 0
            ? [makeBill("1", "2026-02-01")]
            : [makeBill("2", "2026-03-01")];
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

  test("shows an empty state when there are no bills", async () => {
    server.use(
      http.get("*/api/v1/bills", () =>
        HttpResponse.json({ items: [], total: 0, limit: 10, offset: 0 }),
      ),
    );

    renderPage();

    expect(await screen.findByText("No bills yet.")).toBeInTheDocument();
  });
});
