import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { OrganizationDetailsPage } from "./components/organization-details-page";

const now = "2026-01-01T00:00:00Z";
const ORG_ID = "11111111-1111-1111-1111-111111111111";

const renderPage = () =>
  renderWithRouter(<OrganizationDetailsPage orgId={ORG_ID} />, {
    initialPath: `/organizations/${ORG_ID}`,
    linkPaths: ["/organizations"],
  });

describe("OrganizationDetailsPage", () => {
  test("renders the logo when the organization has one", async () => {
    server.use(
      http.get(`*/api/v1/organizations/${ORG_ID}`, () =>
        HttpResponse.json({
          id: ORG_ID,
          created_at: now,
          name: "Acme Properties",
          logo_url: "https://cdn.test/acme.png",
        }),
      ),
    );

    renderPage();

    const logo = await screen.findByRole("img", {
      name: "Acme Properties logo",
    });
    expect(logo).toHaveAttribute("src", "https://cdn.test/acme.png");
  });

  test("renders the organization's details", async () => {
    server.use(
      http.get(`*/api/v1/organizations/${ORG_ID}`, () =>
        HttpResponse.json({
          id: ORG_ID,
          created_at: now,
          name: "Acme Properties",
          email: "hello@acme.com",
          phone: "+254700000000",
          website: "https://acme.com",
        }),
      ),
    );

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Acme Properties" }),
    ).toBeInTheDocument();
    // Contact fields render as actionable links.
    expect(screen.getByRole("link", { name: "hello@acme.com" })).toHaveAttribute(
      "href",
      "mailto:hello@acme.com",
    );
    expect(screen.getByRole("link", { name: "+254700000000" })).toHaveAttribute(
      "href",
      "tel:+254700000000",
    );
    expect(
      screen.getByRole("link", { name: "https://acme.com" }),
    ).toHaveAttribute("href", "https://acme.com");
  });

  test("shows placeholders when contact fields are absent", async () => {
    server.use(
      http.get(`*/api/v1/organizations/${ORG_ID}`, () =>
        HttpResponse.json({
          id: ORG_ID,
          created_at: now,
          name: "Acme Properties",
          email: null,
          phone: null,
          website: null,
        }),
      ),
    );

    renderPage();

    await screen.findByRole("heading", { name: "Acme Properties" });
    // Email, phone, and website each fall back to an em dash.
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  test("shows an error message when the request fails", async () => {
    server.use(
      http.get(`*/api/v1/organizations/${ORG_ID}`, () =>
        HttpResponse.json(
          { detail: "Could not load organization" },
          { status: 404 },
        ),
      ),
    );

    renderPage();

    expect(
      await screen.findByText("Could not load organization"),
    ).toBeInTheDocument();
  });
});
