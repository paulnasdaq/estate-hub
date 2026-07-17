import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { PersonDetailsPage } from "./components/person-details-page";

const now = "2026-01-01T00:00:00Z";
const PERSON_ID = "11111111-1111-1111-1111-111111111111";

const renderPage = () =>
  renderWithRouter(<PersonDetailsPage personId={PERSON_ID} />, {
    initialPath: `/people/${PERSON_ID}`,
    linkPaths: ["/people"],
  });

describe("PersonDetailsPage", () => {
  test("renders the person's contact details and accounts", async () => {
    server.use(
      http.get(`*/api/v1/users/${PERSON_ID}`, () =>
        HttpResponse.json({
          id: PERSON_ID,
          created_at: now,
          deleted_at: null,
          first_name: "Ada",
          last_name: "Lovelace",
          email: "ada@example.com",
          phone: "+15550001111",
          accounts: [
            {
              id: "99999999-9999-9999-9999-999999999999",
              created_at: now,
              organization_id: "22222222-2222-2222-2222-222222222222",
            },
          ],
        }),
      ),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Ada Lovelace" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("+15550001111")).toBeInTheDocument();
    // The account row renders the truncated organization id.
    expect(screen.getByText("22222222")).toBeInTheDocument();
  });

  test("shows an empty state when the person has no accounts", async () => {
    server.use(
      http.get(`*/api/v1/users/${PERSON_ID}`, () =>
        HttpResponse.json({
          id: PERSON_ID,
          created_at: now,
          deleted_at: null,
          first_name: "Grace",
          last_name: "Hopper",
          email: "grace@example.com",
          phone: null,
          accounts: [],
        }),
      ),
    );

    renderPage();

    expect(
      await screen.findByText("This person has no accounts."),
    ).toBeInTheDocument();
  });

  test("shows an error message when the request fails", async () => {
    server.use(
      http.get(`*/api/v1/users/${PERSON_ID}`, () =>
        HttpResponse.json({ detail: "Could not load person" }, { status: 404 }),
      ),
    );

    renderPage();

    expect(await screen.findByText("Could not load person")).toBeInTheDocument();
  });
});
