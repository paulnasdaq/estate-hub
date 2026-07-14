import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";

import { render, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { PersonForm } from "./components/person-form";

describe("PersonForm", () => {
  test("creates a person and calls onCreated", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    // Capture the POST body to assert the form sends the right payload.
    let posted: unknown;
    server.use(
      http.post("*/api/v1/users", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(
          {
            id: "new-id",
            created_at: "2026-01-01T00:00:00Z",
            accounts: [],
            ...(posted as object),
          },
          { status: 201 },
        );
      }),
    );

    render(<PersonForm onCreated={onCreated} />);

    await user.type(screen.getByLabelText("First name"), "Ada");
    await user.type(screen.getByLabelText("Last name"), "Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Phone"), "+15550001111");

    // Radix Select: open, then choose the org from the default handler.
    await user.click(screen.getByRole("combobox", { name: /organization/i }));
    await user.click(
      await screen.findByRole("option", { name: "Acme Properties" }),
    );

    await user.click(screen.getByRole("button", { name: /create person/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(posted).toEqual({
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      phone: "+15550001111",
      organization_id: "11111111-1111-1111-1111-111111111111",
    });
  });

  test("sends null phone when left blank", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    let posted: { phone?: unknown } = {};
    server.use(
      http.post("*/api/v1/users", async ({ request }) => {
        posted = (await request.json()) as { phone?: unknown };
        return HttpResponse.json(
          {
            id: "new-id",
            created_at: "2026-01-01T00:00:00Z",
            accounts: [],
            ...posted,
          },
          { status: 201 },
        );
      }),
    );

    render(<PersonForm onCreated={onCreated} />);

    await user.type(screen.getByLabelText("First name"), "Grace");
    await user.type(screen.getByLabelText("Last name"), "Hopper");
    await user.type(screen.getByLabelText("Email"), "grace@example.com");
    await user.click(screen.getByRole("combobox", { name: /organization/i }));
    await user.click(
      await screen.findByRole("option", { name: "Acme Properties" }),
    );
    await user.click(screen.getByRole("button", { name: /create person/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(posted.phone).toBeNull();
  });

  test("blocks submit and shows validation errors when empty", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    render(<PersonForm onCreated={onCreated} />);

    await user.click(screen.getByRole("button", { name: /create person/i }));

    expect(
      await screen.findByText("First name is required"),
    ).toBeInTheDocument();
    expect(screen.getByText("Organization is required")).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
