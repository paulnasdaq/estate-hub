import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";

import { render, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { PropertyForm } from "./components/property-form";

describe("PropertyForm", () => {
  test("creates a property and calls onCreated", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    // Capture the POST body to assert the form sends the right payload.
    let posted: unknown;
    server.use(
      http.post("*/api/v1/properties", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(
          { id: "new-id", created_at: "2026-01-01T00:00:00Z", ...(posted as object) },
          { status: 201 },
        );
      }),
    );

    render(<PropertyForm onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Name"), "Birchwood Flats");

    // Radix Select: open, then choose the org from the default handler.
    await user.click(screen.getByRole("combobox", { name: /organization/i }));
    await user.click(
      await screen.findByRole("option", { name: "Acme Properties" }),
    );

    await user.type(screen.getByLabelText("Latitude"), "30.27");
    await user.type(screen.getByLabelText("Longitude"), "-97.74");
    await user.click(screen.getByRole("button", { name: /create property/i }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(posted).toEqual({
      name: "Birchwood Flats",
      organization_id: "11111111-1111-1111-1111-111111111111",
      lat: 30.27,
      lng: -97.74,
    });
    // onCreated receives the created property so the caller can navigate to it.
    expect(onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: "new-id", name: "Birchwood Flats" }),
    );
  });

  test("blocks submit and shows validation errors when empty", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    render(<PropertyForm onCreated={onCreated} />);

    await user.click(screen.getByRole("button", { name: /create property/i }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Organization is required")).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
