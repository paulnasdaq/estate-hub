import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { renderWithRouter, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { EditUnitPage } from "./components/edit-unit-page";

const PROPERTY_ID = "22222222-2222-2222-2222-222222222222";
const UNIT_ID = "55555555-5555-5555-5555-555555555555";

// The page links back to the unit detail and navigates to the units list after
// delete, so both routes need registering in the test router.
const renderPage = () =>
  renderWithRouter(
    <EditUnitPage propertyId={PROPERTY_ID} unitId={UNIT_ID} />,
    {
      initialPath: "/edit",
      linkPaths: [
        "/properties/$propertyId/units",
        "/properties/$propertyId/units/$unitId",
      ],
    },
  );

describe("EditUnitPage", () => {
  test("prefills the form from the loaded unit", async () => {
    renderPage();

    // Uses the default get-unit handler (name "Unit 1", price 1200).
    expect(await screen.findByDisplayValue("Unit 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1200")).toBeInTheDocument();
    // No media picker in edit mode.
    expect(screen.queryByLabelText("Add media files")).not.toBeInTheDocument();
  });

  test("saves edits with a PATCH and navigates to the unit", async () => {
    const user = userEvent.setup();

    let patched: unknown;
    let patchedId: string | undefined;
    server.use(
      http.patch("*/api/v1/units/:unitId", async ({ request, params }) => {
        patchedId = params.unitId as string;
        patched = await request.json();
        return HttpResponse.json({
          id: UNIT_ID,
          created_at: "2026-01-01T00:00:00Z",
          property_id: PROPERTY_ID,
          ...(patched as object),
        });
      }),
    );

    renderPage();

    const name = await screen.findByDisplayValue("Unit 1");
    await user.clear(name);
    await user.type(name, "Penthouse");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(patchedId).toBe(UNIT_ID));
    expect(patched).toEqual({ name: "Penthouse", price: 1200 });
    // On success the page navigates away, unmounting the edit heading.
    await waitFor(() =>
      expect(screen.queryByText("Edit unit")).not.toBeInTheDocument(),
    );
  });

  test("deletes the unit after confirming, then navigates away", async () => {
    const user = userEvent.setup();

    let deletedId: string | undefined;
    server.use(
      http.delete("*/api/v1/units/:unitId", ({ params }) => {
        deletedId = params.unitId as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();
    await screen.findByDisplayValue("Unit 1");

    await user.click(screen.getByRole("button", { name: /delete unit/i }));

    // Confirmation dialog: the exact-name "Delete" button is the confirm action.
    const confirm = await screen.findByRole("button", { name: "Delete" });
    await user.click(confirm);

    await waitFor(() => expect(deletedId).toBe(UNIT_ID));
    await waitFor(() =>
      expect(screen.queryByText("Edit unit")).not.toBeInTheDocument(),
    );
  });

  test("keeps the unit when the delete is cancelled", async () => {
    const user = userEvent.setup();

    let deleteCalled = false;
    server.use(
      http.delete("*/api/v1/units/:unitId", () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();
    await screen.findByDisplayValue("Unit 1");

    await user.click(screen.getByRole("button", { name: /delete unit/i }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(deleteCalled).toBe(false);
    expect(screen.getByText("Edit unit")).toBeInTheDocument();
  });
});
