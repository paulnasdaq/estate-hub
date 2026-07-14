import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";

import { render, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { LeaseForm } from "./components/lease-form";

const now = "2026-01-01T00:00:00Z";
const ACCOUNT_ID = "33333333-3333-3333-3333-333333333333";
const PROPERTY_ID = "22222222-2222-2222-2222-222222222222";
const UNIT_ID = "55555555-5555-5555-5555-555555555555";

// A person carrying one account, so the tenant select has a selectable option.
function stubPeople() {
  server.use(
    http.get("*/api/v1/users", () =>
      HttpResponse.json({
        items: [
          {
            id: "u1",
            created_at: now,
            first_name: "Ada",
            last_name: "Lovelace",
            email: "ada@example.com",
            phone: null,
            accounts: [
              { id: ACCOUNT_ID, created_at: now, organization_id: null },
            ],
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      }),
    ),
  );
}

// Pick a property and then a unit through the two autocompletes.
async function selectPropertyAndUnit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("combobox", { name: "Property" }), "Maple");
  await user.click(await screen.findByRole("option", { name: "Maple Court" }));

  await user.click(screen.getByRole("combobox", { name: "Unit" }));
  await user.click(await screen.findByRole("option", { name: "Unit 1" }));
}

describe("LeaseForm", () => {
  test("creates a lease via the property + unit autocompletes", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    stubPeople();

    // Capture the POST body to assert the form sends the right payload.
    let posted: {
      unit_id?: string;
      account_id?: string;
      effective_from?: string;
    } = {};
    server.use(
      http.post("*/api/v1/leases", async ({ request }) => {
        posted = (await request.json()) as typeof posted;
        return HttpResponse.json(
          { id: "new-id", created_at: now, terminated_on: null, ...posted },
          { status: 201 },
        );
      }),
    );

    render(<LeaseForm onCreated={onCreated} />);

    await selectPropertyAndUnit(user);

    // Tenant select (from the stubbed people handler).
    await user.click(screen.getByRole("combobox", { name: /tenant/i }));
    await user.click(await screen.findByRole("option", { name: "Ada Lovelace" }));

    await user.type(screen.getByLabelText("Start date"), "2026-02-01");
    await user.click(screen.getByRole("button", { name: /create lease/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(posted.unit_id).toBe(UNIT_ID);
    expect(posted.account_id).toBe(ACCOUNT_ID);
    // The date input value is converted to an ISO datetime.
    expect(posted.effective_from).toBe("2026-02-01T00:00:00.000Z");
  });

  test("submits added lease terms", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    stubPeople();

    let posted: {
      terms?: {
        name: string;
        amount: number;
        interval: string;
        rate: string;
        type: string;
      }[];
    } = {};
    server.use(
      http.post("*/api/v1/leases", async ({ request }) => {
        posted = (await request.json()) as typeof posted;
        return HttpResponse.json(
          { id: "new-id", created_at: now, terminated_on: null, terms: [] },
          { status: 201 },
        );
      }),
    );

    render(<LeaseForm onCreated={onCreated} />);

    await selectPropertyAndUnit(user);
    await user.click(screen.getByRole("combobox", { name: /tenant/i }));
    await user.click(await screen.findByRole("option", { name: "Ada Lovelace" }));
    await user.type(screen.getByLabelText("Start date"), "2026-02-01");

    // Add a term and fill it in (interval/rate/type default to
    // monthly/fixed/prepaid).
    await user.click(screen.getByRole("button", { name: /add term/i }));
    await user.type(screen.getByLabelText("Name"), "Rent");
    await user.type(screen.getByLabelText("Amount"), "1200");

    await user.click(screen.getByRole("button", { name: /create lease/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(posted.terms).toEqual([
      {
        name: "Rent",
        amount: 1200,
        interval: "monthly",
        rate: "fixed",
        type: "prepaid",
      },
    ]);
  });

  test("removes an added lease term", async () => {
    const user = userEvent.setup();
    stubPeople();

    render(<LeaseForm onCreated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /add term/i }));
    expect(screen.getByText("Term 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove term 1/i }));
    expect(screen.queryByText("Term 1")).not.toBeInTheDocument();
  });

  test("scopes the unit search to the chosen property", async () => {
    const user = userEvent.setup();
    stubPeople();

    // Record which property the unit lookup is scoped to.
    let requestedPropertyId: string | undefined;
    server.use(
      http.get("*/api/v1/properties/:propertyId/units", ({ params }) => {
        requestedPropertyId = params.propertyId as string;
        return HttpResponse.json({
          items: [
            {
              id: UNIT_ID,
              created_at: now,
              name: "Unit 1",
              price: 1200,
              property_id: params.propertyId,
            },
          ],
          total: 1,
          limit: 10,
          offset: 0,
        });
      }),
    );

    render(<LeaseForm onCreated={vi.fn()} />);

    // The unit field is disabled until a property is chosen.
    expect(screen.getByRole("combobox", { name: "Unit" })).toBeDisabled();

    await selectPropertyAndUnit(user);

    expect(requestedPropertyId).toBe(PROPERTY_ID);
    expect(screen.getByRole("combobox", { name: "Unit" })).not.toBeDisabled();
  });

  test("blocks submit and shows validation errors when empty", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    stubPeople();

    render(<LeaseForm onCreated={onCreated} />);

    await user.click(screen.getByRole("button", { name: /create lease/i }));

    expect(await screen.findByText("Unit is required")).toBeInTheDocument();
    expect(screen.getByText("Tenant is required")).toBeInTheDocument();
    expect(screen.getByText("Start date is required")).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
