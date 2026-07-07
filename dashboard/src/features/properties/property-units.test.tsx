import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { render, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { PropertyUnits } from "./components/property-units";

const PROPERTY_ID = "22222222-2222-2222-2222-222222222222";

describe("PropertyUnits", () => {
  test("lists the property's units", async () => {
    // Uses the default nested-units handler.
    render(<PropertyUnits propertyId={PROPERTY_ID} />);

    expect(await screen.findByText("Unit 1")).toBeInTheDocument();
  });

  test("shows an empty state when there are no units", async () => {
    server.use(
      http.get("*/api/v1/properties/:propertyId/units", () =>
        HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
      ),
    );

    render(<PropertyUnits propertyId={PROPERTY_ID} />);

    expect(await screen.findByText("No units yet.")).toBeInTheDocument();
  });

  test("creates a unit scoped to the property", async () => {
    const user = userEvent.setup();

    // Capture the POST to assert path + body.
    let postedUrl = "";
    let posted: unknown;
    server.use(
      http.post(
        "*/api/v1/properties/:propertyId/units",
        async ({ request }) => {
          postedUrl = request.url;
          posted = await request.json();
          return HttpResponse.json(
            {
              id: "unit-new",
              created_at: "2026-01-01T00:00:00Z",
              property_id: PROPERTY_ID,
              ...(posted as object),
            },
            { status: 201 },
          );
        },
      ),
    );

    render(<PropertyUnits propertyId={PROPERTY_ID} />);

    await user.type(screen.getByLabelText("Unit name"), "Penthouse");
    await user.click(screen.getByRole("button", { name: /add unit/i }));

    await waitFor(() => expect(posted).toEqual({ name: "Penthouse" }));
    expect(postedUrl).toContain(`/properties/${PROPERTY_ID}/units`);
  });

  test("does not submit a blank unit name", async () => {
    const user = userEvent.setup();
    render(<PropertyUnits propertyId={PROPERTY_ID} />);

    // The button is disabled until a non-empty name is entered.
    const addButton = screen.getByRole("button", { name: /add unit/i });
    expect(addButton).toBeDisabled();

    await user.type(screen.getByLabelText("Unit name"), "   ");
    expect(addButton).toBeDisabled();
  });
});
