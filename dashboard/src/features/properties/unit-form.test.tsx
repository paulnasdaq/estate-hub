import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";

import { render, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { UnitForm } from "./components/unit-form";
import { unitFormSchema } from "./schemas";

const PROPERTY_ID = "22222222-2222-2222-2222-222222222222";

describe("UnitForm", () => {
  test("creates a unit scoped to the property and calls onSaved", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

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

    render(<UnitForm propertyId={PROPERTY_ID} onSaved={onSaved} />);

    await user.type(screen.getByLabelText("Name"), "Penthouse");
    await user.type(screen.getByLabelText("Price"), "2500");
    await user.click(screen.getByRole("button", { name: /add unit/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(posted).toEqual({ name: "Penthouse", price: 2500 });
    expect(postedUrl).toContain(`/properties/${PROPERTY_ID}/units`);
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: "unit-new", name: "Penthouse" }),
    );
  });

  test("uploads staged media after creating the unit", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    let putCalled = false;
    let mediaBody: unknown;
    server.use(
      http.post("*/api/v1/properties/:propertyId/units", async ({ request }) => {
        const body = (await request.json()) as object;
        return HttpResponse.json(
          {
            id: "unit-new",
            created_at: "2026-01-01T00:00:00Z",
            property_id: PROPERTY_ID,
            ...body,
          },
          { status: 201 },
        );
      }),
      http.post(
        "*/api/v1/units/:unitId/media/presigns",
        async ({ request }) => {
          const body = (await request.json()) as { filename: string };
          return HttpResponse.json({
            storage_key: `units/unit-new/images/${body.filename}`,
            upload_url: "http://s3.test/upload",
          });
        },
      ),
      // The bytes go straight to (mocked) S3 via a raw PUT, not our API.
      http.put("http://s3.test/upload", () => {
        putCalled = true;
        return new HttpResponse(null, { status: 200 });
      }),
      http.post("*/api/v1/media", async ({ request }) => {
        mediaBody = await request.json();
        return HttpResponse.json(
          {
            id: "media-1",
            created_at: "2026-01-01T00:00:00Z",
            deleted_at: null,
            ...(mediaBody as object),
          },
          { status: 201 },
        );
      }),
    );

    render(<UnitForm propertyId={PROPERTY_ID} onSaved={onSaved} />);

    await user.type(screen.getByLabelText("Name"), "Penthouse");
    await user.type(screen.getByLabelText("Price"), "2500");

    const file = new File(["img"], "bedroom.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Add media files"), file);
    expect(screen.getByText("bedroom.jpg")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add unit/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    // The object was PUT to storage and then recorded under the new unit, with
    // the first file marked primary.
    expect(putCalled).toBe(true);
    expect(mediaBody).toEqual(
      expect.objectContaining({
        entity_type: "unit",
        entity_id: "unit-new",
        storage_key: "units/unit-new/images/bedroom.jpg",
        content_type: "image/jpeg",
        is_primary: true,
        display_order: 0,
      }),
    );
  });

  test("blocks submit and shows validation errors when empty", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    render(<UnitForm propertyId={PROPERTY_ID} onSaved={onSaved} />);

    await user.click(screen.getByRole("button", { name: /add unit/i }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Price is required")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  // A number <input> in jsdom can't hold an intermediate "-", so the negative
  // and non-integer guards are asserted against the schema directly.
  test("schema rejects negative and non-integer prices", () => {
    const negative = unitFormSchema.safeParse({ name: "A", price: "-5" });
    expect(negative.success).toBe(false);
    expect(negative.error?.issues[0]?.message).toBe("Price can't be negative");

    const fractional = unitFormSchema.safeParse({ name: "A", price: "10.5" });
    expect(fractional.success).toBe(false);
    expect(fractional.error?.issues[0]?.message).toBe(
      "Price must be a whole number",
    );

    expect(unitFormSchema.safeParse({ name: "A", price: "1200" }).success).toBe(
      true,
    );
  });
});
