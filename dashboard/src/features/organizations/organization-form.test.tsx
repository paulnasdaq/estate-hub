import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";

import { render, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { OrganizationForm } from "./components/organization-form";
import type { Organization } from "./types";

const now = "2026-01-01T00:00:00Z";

describe("OrganizationForm", () => {
  test("creates an organization and calls onSaved", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    // Capture the POST body to assert the form sends the right payload.
    let posted: unknown;
    server.use(
      http.post("*/api/v1/organizations", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(
          {
            id: "new-id",
            created_at: now,
            ...(posted as object),
          },
          { status: 201 },
        );
      }),
    );

    render(<OrganizationForm onSaved={onSaved} />);

    await user.type(screen.getByLabelText("Name"), "Birchwood Group");
    await user.type(screen.getByLabelText("Email"), "hello@birchwood.com");
    await user.type(screen.getByLabelText("Phone"), "+254700000000");
    await user.type(screen.getByLabelText("Website"), "https://birchwood.com");
    await user.click(
      screen.getByRole("button", { name: /create organization/i }),
    );

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(posted).toEqual({
      name: "Birchwood Group",
      email: "hello@birchwood.com",
      phone: "+254700000000",
      website: "https://birchwood.com",
    });
  });

  test("sends null for omitted optional contact fields", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    let posted: unknown;
    server.use(
      http.post("*/api/v1/organizations", async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json(
          { id: "new-id", created_at: now, ...(posted as object) },
          { status: 201 },
        );
      }),
    );

    render(<OrganizationForm onSaved={onSaved} />);

    await user.type(screen.getByLabelText("Name"), "Birchwood Group");
    await user.click(
      screen.getByRole("button", { name: /create organization/i }),
    );

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(posted).toEqual({
      name: "Birchwood Group",
      email: null,
      phone: null,
      website: null,
    });
  });

  test("blocks submit and shows a validation error for a malformed email", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    render(<OrganizationForm onSaved={onSaved} />);

    await user.type(screen.getByLabelText("Name"), "Birchwood Group");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(
      screen.getByRole("button", { name: /create organization/i }),
    );

    expect(
      await screen.findByText("Enter a valid email"),
    ).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  test("prefills and updates an existing organization", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const organization: Organization = {
      id: "22222222-2222-2222-2222-222222222222",
      created_at: now,
      name: "Acme Properties",
      email: "hello@acme.com",
      phone: "+254700000000",
      website: "https://acme.com",
    };

    // Capture the PATCH body to assert the form sends the edited payload.
    let patched: unknown;
    server.use(
      http.patch(
        `*/api/v1/organizations/${organization.id}`,
        async ({ request }) => {
          patched = await request.json();
          return HttpResponse.json({
            id: organization.id,
            created_at: now,
            ...(patched as object),
          });
        },
      ),
    );

    render(<OrganizationForm organization={organization} onSaved={onSaved} />);

    const nameInput = screen.getByLabelText("Name");
    expect(nameInput).toHaveValue("Acme Properties");
    // Contact fields prefill from the existing organization.
    expect(screen.getByLabelText("Email")).toHaveValue("hello@acme.com");
    expect(screen.getByLabelText("Phone")).toHaveValue("+254700000000");
    expect(screen.getByLabelText("Website")).toHaveValue("https://acme.com");

    await user.clear(nameInput);
    await user.type(nameInput, "Acme Holdings");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(patched).toEqual({
      name: "Acme Holdings",
      email: "hello@acme.com",
      phone: "+254700000000",
      website: "https://acme.com",
    });
  });

  test("blocks submit and shows validation errors when empty", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    render(<OrganizationForm onSaved={onSaved} />);

    await user.click(
      screen.getByRole("button", { name: /create organization/i }),
    );

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  test("uploads a picked logo after creating the organization", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    let setLogoKey: string | undefined;
    server.use(
      http.post("*/api/v1/organizations", async ({ request }) =>
        HttpResponse.json(
          { id: "org-1", created_at: now, ...((await request.json()) as object) },
          { status: 201 },
        ),
      ),
      // presign + storage PUT use the default handlers; capture the final
      // set-logo call to assert the uploaded key is recorded.
      http.put("*/api/v1/organizations/org-1/logo", async ({ request }) => {
        setLogoKey = ((await request.json()) as { storage_key: string })
          .storage_key;
        return HttpResponse.json({
          id: "org-1",
          created_at: now,
          name: "Birchwood Group",
          logo_url: "https://cdn.test/birchwood.png",
        });
      }),
    );

    render(<OrganizationForm onSaved={onSaved} />);

    await user.type(screen.getByLabelText("Name"), "Birchwood Group");
    const file = new File(["logo-bytes"], "logo.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Logo"), file);
    await user.click(
      screen.getByRole("button", { name: /create organization/i }),
    );

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    // The key the backend recorded is scoped to the newly-created org.
    expect(setLogoKey).toBe("organizations/org-1/logo/logo.png");
    expect(onSaved.mock.calls[0][0].logo_url).toBe(
      "https://cdn.test/birchwood.png",
    );
  });

  test("removes an existing logo in edit mode", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const organization: Organization = {
      id: "org-2",
      created_at: now,
      name: "Acme Properties",
      logo_url: "https://cdn.test/old.png",
    };

    let deleteCalled = false;
    server.use(
      http.patch("*/api/v1/organizations/org-2", async ({ request }) =>
        HttpResponse.json({
          id: "org-2",
          created_at: now,
          ...((await request.json()) as object),
        }),
      ),
      http.delete("*/api/v1/organizations/org-2/logo", () => {
        deleteCalled = true;
        return HttpResponse.json({
          id: "org-2",
          created_at: now,
          name: "Acme Properties",
          logo_url: null,
        });
      }),
    );

    render(<OrganizationForm organization={organization} onSaved={onSaved} />);

    // The existing logo is shown until the user removes it.
    expect(
      screen.getByRole("img", { name: "Organization logo" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(deleteCalled).toBe(true);
    expect(onSaved.mock.calls[0][0].logo_url).toBeNull();
  });
});
