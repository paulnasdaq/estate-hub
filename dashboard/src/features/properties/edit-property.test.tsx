import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";

import { renderWithRouter, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { EditPropertyPage } from "./components/edit-property-page";

// The form lazy-loads a WebGL map picker; stub it so the edit page renders
// without a GL context (the picker itself is covered by its own test).
vi.mock("./components/location-picker", () => ({
  LocationPicker: () => <div data-testid="location-picker" />,
}));

const PROPERTY_ID = "22222222-2222-2222-2222-222222222222";

// The page links back to the property and navigates to the list after delete,
// so both routes need registering in the test router.
const renderPage = () =>
  renderWithRouter(<EditPropertyPage propertyId={PROPERTY_ID} />, {
    initialPath: "/edit",
    linkPaths: ["/properties", "/properties/$propertyId"],
  });

describe("EditPropertyPage", () => {
  test("prefills the form from the loaded property", async () => {
    renderPage();

    // Uses the default get-by-id handler (name "Maple Court").
    expect(await screen.findByDisplayValue("Maple Court")).toBeInTheDocument();
  });

  test("deletes the property after confirming, then navigates to the list", async () => {
    const user = userEvent.setup();

    let deletedId: string | undefined;
    server.use(
      http.delete("*/api/v1/properties/:propertyId", ({ params }) => {
        deletedId = params.propertyId as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();

    // Wait for the property to load so the danger zone renders.
    await screen.findByDisplayValue("Maple Court");

    await user.click(screen.getByRole("button", { name: /delete property/i }));

    // Confirmation dialog: the exact-name "Delete" button is the confirm action.
    const confirm = await screen.findByRole("button", { name: "Delete" });
    await user.click(confirm);

    await waitFor(() => expect(deletedId).toBe(PROPERTY_ID));
    // On success the page navigates away, unmounting the edit heading.
    await waitFor(() =>
      expect(screen.queryByText("Edit property")).not.toBeInTheDocument(),
    );
  });

  test("keeps the property when the delete is cancelled", async () => {
    const user = userEvent.setup();

    let deleteCalled = false;
    server.use(
      http.delete("*/api/v1/properties/:propertyId", () => {
        deleteCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();
    await screen.findByDisplayValue("Maple Court");

    await user.click(screen.getByRole("button", { name: /delete property/i }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(deleteCalled).toBe(false);
    expect(screen.getByText("Edit property")).toBeInTheDocument();
  });
});
