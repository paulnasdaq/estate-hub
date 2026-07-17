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
  // The option label includes the unit's price alongside its name.
  await user.click(await screen.findByRole("option", { name: /Unit 1/ }));
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
    // Selecting the unit prefills the rent term's amount, so the form is valid.
    await user.click(screen.getByRole("button", { name: /create lease/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(posted.unit_id).toBe(UNIT_ID);
    expect(posted.account_id).toBe(ACCOUNT_ID);
    // The date input value is converted to an ISO datetime.
    expect(posted.effective_from).toBe("2026-02-01T00:00:00.000Z");
  });

  test("submits the default rent term", async () => {
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

    // The form starts with a rent term (name "Rent", interval/rate/type default
    // to monthly/fixed/prepaid) whose amount is prefilled from the unit's price.
    expect(screen.getByLabelText("Amount")).toHaveValue(1200);

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

  test("adds and removes an extra lease term", async () => {
    const user = userEvent.setup();
    stubPeople();

    render(<LeaseForm onCreated={vi.fn()} />);

    // The default rent term is Term 1; adding one gives Term 2.
    await user.click(screen.getByRole("button", { name: /add term/i }));
    expect(screen.getByText("Term 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove term 2/i }));
    expect(screen.queryByText("Term 2")).not.toBeInTheDocument();
    expect(screen.getByText("Term 1")).toBeInTheDocument();
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

  test("shows the unit price alongside its name in the dropdown", async () => {
    const user = userEvent.setup();
    stubPeople();

    render(<LeaseForm onCreated={vi.fn()} />);

    await user.type(screen.getByRole("combobox", { name: "Property" }), "Maple");
    await user.click(await screen.findByRole("option", { name: "Maple Court" }));
    await user.click(screen.getByRole("combobox", { name: "Unit" }));

    // The default units handler returns "Unit 1" at a price of 1200.
    const option = await screen.findByRole("option", { name: /Unit 1/ });
    expect(option).toHaveTextContent("Unit 1");
    expect(option).toHaveTextContent("$1,200");
  });

  test("creates a tenant inline and selects it for the lease", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    // Start with no existing people so the tenant comes purely from the inline
    // creation flow. The POST handler returns a user carrying one account.
    const NEW_ACCOUNT_ID = "99999999-9999-9999-9999-999999999999";
    server.use(
      http.get("*/api/v1/users", () =>
        HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 }),
      ),
      http.post("*/api/v1/users", async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            id: "88888888-8888-8888-8888-888888888888",
            created_at: now,
            deleted_at: null,
            accounts: [
              { id: NEW_ACCOUNT_ID, created_at: now, organization_id: null },
            ],
            ...body,
          },
          { status: 201 },
        );
      }),
    );

    let posted: { account_id?: string } = {};
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

    // Open the inline tenant creation panel and fill the person form.
    await user.click(screen.getByRole("button", { name: /new tenant/i }));
    await user.type(await screen.findByLabelText("First name"), "Grace");
    await user.type(screen.getByLabelText("Last name"), "Hopper");
    await user.type(screen.getByLabelText("Email"), "grace@example.com");
    await user.click(screen.getByRole("combobox", { name: /organization/i }));
    await user.click(await screen.findByRole("option", { name: "Acme Properties" }));
    await user.click(screen.getByRole("button", { name: /create person/i }));

    // The panel (a dialog) closes once the tenant is created and auto-selected.
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText("Start date"), "2026-02-01");
    await user.click(screen.getByRole("button", { name: /create lease/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    // The lease is created against the freshly created person's account.
    expect(posted.account_id).toBe(NEW_ACCOUNT_ID);
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
