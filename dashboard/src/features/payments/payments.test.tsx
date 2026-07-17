import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { PaymentsPage } from "./components/payments-page";

const now = "2026-01-01T00:00:00Z";

function makePayment(id: string, amount: number) {
  return {
    id,
    created_at: now,
    deleted_at: null,
    amount,
    payment_request_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  };
}

const renderPage = () =>
  renderWithRouter(<PaymentsPage />, { initialPath: "/payments" });

describe("PaymentsPage", () => {
  test("renders the payments returned by the API", async () => {
    server.use(
      http.get("*/api/v1/payments", () =>
        HttpResponse.json({
          items: [makePayment("1", 1500)],
          total: 1,
          limit: 10,
          offset: 0,
        }),
      ),
    );

    renderPage();

    // The payment amount is currency-formatted.
    expect(await screen.findByText("$1,500")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Payments" }),
    ).toBeInTheDocument();
  });

  test("shows an error message when the request fails", async () => {
    server.use(
      http.get("*/api/v1/payments", () =>
        HttpResponse.json(
          { detail: "Could not load payments" },
          { status: 500 },
        ),
      ),
    );

    renderPage();

    expect(
      await screen.findByText("Could not load payments"),
    ).toBeInTheDocument();
  });

  test("pages through the list by offset", async () => {
    const user = userEvent.setup();
    // 10 rows per page; page 2 holds a single extra row.
    server.use(
      http.get("*/api/v1/payments", ({ request }) => {
        const offset = Number(
          new URL(request.url).searchParams.get("offset") ?? "0",
        );
        const items =
          offset === 0
            ? [makePayment("1", 1500)]
            : [makePayment("2", 2500)];
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

  test("shows an empty state when there are no payments", async () => {
    server.use(
      http.get("*/api/v1/payments", () =>
        HttpResponse.json({ items: [], total: 0, limit: 10, offset: 0 }),
      ),
    );

    renderPage();

    expect(await screen.findByText("No payments yet.")).toBeInTheDocument();
  });
});
