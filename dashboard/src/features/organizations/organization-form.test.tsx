import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";

import { render, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { OrganizationForm } from "./components/organization-form";

describe("OrganizationForm", () => {
  test("creates an organization and calls onCreated", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    // Capture the POST body to assert the form sends the right payload.
    let posted: unknown;
    server.use(
      http.post("*/api/v1/organizations", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(
          {
            id: "new-id",
            created_at: "2026-01-01T00:00:00Z",
            ...(posted as object),
          },
          { status: 201 },
        );
      }),
    );

    render(<OrganizationForm onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Name"), "Birchwood Group");
    await user.click(
      screen.getByRole("button", { name: /create organization/i }),
    );

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(posted).toEqual({ name: "Birchwood Group" });
  });

  test("blocks submit and shows validation errors when empty", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    render(<OrganizationForm onCreated={onCreated} />);

    await user.click(
      screen.getByRole("button", { name: /create organization/i }),
    );

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
