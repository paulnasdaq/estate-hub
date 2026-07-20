import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { EditOrganizationPage } from "./components/edit-organization-page";

const ORG_ID = "11111111-1111-1111-1111-111111111111";

// The page links back to the organization and navigates to the list after
// delete, so both routes need registering in the test router.
const renderPage = () =>
  renderWithRouter(<EditOrganizationPage orgId={ORG_ID} />, {
    initialPath: "/edit",
    linkPaths: ["/organizations", "/organizations/$orgId"],
  });

describe("EditOrganizationPage", () => {
  test("prefills the form from the loaded organization", async () => {
    renderPage();

    // Uses the default get-by-id handler (name "Acme Properties").
    expect(
      await screen.findByDisplayValue("Acme Properties"),
    ).toBeInTheDocument();
  });

  test("deletes the organization after confirming, then navigates to the list", async () => {
    const user = userEvent.setup();

    let deletedId: string | undefined;
    server.use(
      http.delete("*/api/v1/organizations/:orgId", ({ params }) => {
        deletedId = params.orgId as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();

    // Wait for the organization to load so the danger zone renders.
    await screen.findByDisplayValue("Acme Properties");

    await user.click(
      screen.getByRole("button", { name: /delete organization/i }),
    );

    // Confirmation dialog: the exact-name "Delete" button is the confirm action.
    const confirm = await screen.findByRole("button", { name: "Delete" });
    await user.click(confirm);

    await waitFor(() => expect(deletedId).toBe(ORG_ID));
    // On success the page navigates away, unmounting the edit heading.
    await waitFor(() =>
      expect(screen.queryByText("Edit organization")).not.toBeInTheDocument(),
    );
  });

  test("keeps the organization when the delete is cancelled", async () => {
    const user = userEvent.setup();

    let deleteCalled = false;
    server.use(
      http.delete("*/api/v1/organizations/:orgId", () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();
    await screen.findByDisplayValue("Acme Properties");

    await user.click(
      screen.getByRole("button", { name: /delete organization/i }),
    );
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(deleteCalled).toBe(false);
    expect(screen.getByText("Edit organization")).toBeInTheDocument();
  });
});
