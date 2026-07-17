import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { LeaseDetailsPage } from "./components/lease-details-page";

const now = "2026-01-01T00:00:00Z";
const LEASE_ID = "11111111-1111-1111-1111-111111111111";

const renderPage = () =>
  renderWithRouter(<LeaseDetailsPage leaseId={LEASE_ID} />, {
    initialPath: `/leases/${LEASE_ID}`,
    linkPaths: ["/leases", "/bills/$billId"],
  });

describe("LeaseDetailsPage bills section", () => {
  test("renders the lease's bills with a per-bill total", async () => {
    server.use(
      http.get(`*/api/v1/leases/${LEASE_ID}/bills`, () =>
        HttpResponse.json({
          items: [
            {
              id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
              created_at: now,
              deleted_at: null,
              lease_id: LEASE_ID,
              date: "2026-02-01",
              items: [
                {
                  id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
                  created_at: now,
                  deleted_at: null,
                  name: "Rent",
                  amount: 1200,
                  start_date: "2026-02-01",
                  end_date: "2026-03-01",
                  lease_term_id: null,
                },
                {
                  id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
                  created_at: now,
                  deleted_at: null,
                  name: "Utilities",
                  amount: 300,
                  start_date: "2026-02-01",
                  end_date: "2026-03-01",
                  lease_term_id: null,
                },
              ],
            },
          ],
          total: 1,
          limit: 10,
          offset: 0,
        }),
      ),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Bills" }),
    ).toBeInTheDocument();
    // Item amounts (1200 + 300) are summed into one row total.
    expect(await screen.findByText("$1,500")).toBeInTheDocument();
  });

  test("shows an empty state when the lease has no bills", async () => {
    server.use(
      http.get(`*/api/v1/leases/${LEASE_ID}/bills`, () =>
        HttpResponse.json({ items: [], total: 0, limit: 10, offset: 0 }),
      ),
    );

    renderPage();

    expect(
      await screen.findByText("No bills for this lease yet."),
    ).toBeInTheDocument();
  });
});
