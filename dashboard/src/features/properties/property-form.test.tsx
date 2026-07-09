import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";

import { render, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { PropertyForm } from "./components/property-form";

// Stub the (lazy, WebGL-backed) map picker with a plain button that reports a
// fixed coordinate, so we can exercise the map → form sync without a GL context.
vi.mock("./components/location-picker", () => ({
  LocationPicker: ({
    onChange,
  }: {
    onChange: (coords: { lat: number; lng: number }) => void;
  }) => (
    <button type="button" onClick={() => onChange({ lat: 45.52, lng: -122.68 })}>
      Pick on map
    </button>
  ),
}));

describe("PropertyForm", () => {
  test("creates a property and calls onSaved", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

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

    render(<PropertyForm onSaved={onSaved} />);

    await user.type(screen.getByLabelText("Name"), "Birchwood Flats");

    // Radix Select: open, then choose the org from the default handler.
    await user.click(screen.getByRole("combobox", { name: /organization/i }));
    await user.click(
      await screen.findByRole("option", { name: "Acme Properties" }),
    );

    // Coordinates come from clicking the map, not text inputs; the stubbed
    // picker reports a fixed point.
    await user.click(screen.getByRole("button", { name: /pick on map/i }));
    await user.click(screen.getByRole("button", { name: /create property/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(posted).toEqual({
      name: "Birchwood Flats",
      organization_id: "11111111-1111-1111-1111-111111111111",
      lat: 45.52,
      lng: -122.68,
    });
    // onSaved receives the created property so the caller can navigate to it.
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ id: "new-id", name: "Birchwood Flats" }),
    );
  });

  test("stages media and uploads it after creating the property", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    let putCalled = false;
    let mediaBody: unknown;
    server.use(
      http.post("*/api/v1/properties", async ({ request }) => {
        const body = (await request.json()) as object;
        return HttpResponse.json(
          { id: "new-id", created_at: "2026-01-01T00:00:00Z", ...body },
          { status: 201 },
        );
      }),
      http.post(
        "*/api/v1/properties/:propertyId/media/presigns",
        async ({ request }) => {
          const body = (await request.json()) as { filename: string };
          return HttpResponse.json({
            storage_key: `properties/new-id/images/${body.filename}`,
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

    render(<PropertyForm onSaved={onSaved} />);

    await user.type(screen.getByLabelText("Name"), "Birchwood Flats");
    await user.click(screen.getByRole("combobox", { name: /organization/i }));
    await user.click(
      await screen.findByRole("option", { name: "Acme Properties" }),
    );
    await user.click(screen.getByRole("button", { name: /pick on map/i }));

    // Stage a file in the media section.
    const file = new File(["img"], "kitchen.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Add media files"), file);
    expect(screen.getByText("kitchen.jpg")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /create property/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    // The object was PUT to storage and then recorded, keyed under the property
    // returned by create, with the first file marked primary.
    expect(putCalled).toBe(true);
    expect(mediaBody).toEqual(
      expect.objectContaining({
        entity_type: "property",
        entity_id: "new-id",
        storage_key: "properties/new-id/images/kitchen.jpg",
        content_type: "image/jpeg",
        is_primary: true,
        display_order: 0,
      }),
    );
  });

  test("edits an existing property with a PATCH and calls onSaved", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    const property = {
      id: "abc-123",
      created_at: "2026-01-01T00:00:00Z",
      name: "Maple Court",
      organization_id: "11111111-1111-1111-1111-111111111111",
      lat: 45.52,
      lng: -122.68,
    };

    let patched: unknown;
    let patchedId: string | undefined;
    server.use(
      http.patch(
        "*/api/v1/properties/:propertyId",
        async ({ request, params }) => {
          patched = await request.json();
          patchedId = params.propertyId as string;
          return HttpResponse.json({ ...property, ...(patched as object) });
        },
      ),
    );

    render(<PropertyForm property={property} onSaved={onSaved} />);

    // Fields are prefilled from the property.
    const name = screen.getByLabelText("Name");
    expect(name).toHaveValue("Maple Court");

    await user.clear(name);
    await user.type(name, "Maple Court Renamed");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(patchedId).toBe("abc-123");
    expect(patched).toEqual({
      name: "Maple Court Renamed",
      organization_id: "11111111-1111-1111-1111-111111111111",
      lat: 45.52,
      lng: -122.68,
    });
  });

  test("picking a location on the map shows the selected coordinates", async () => {
    const user = userEvent.setup();

    render(<PropertyForm onSaved={vi.fn()} />);

    // No latitude/longitude inputs — the map is the only way to set them.
    expect(screen.queryByLabelText("Latitude")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Longitude")).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /pick on map/i }));

    expect(screen.getByText("Selected: 45.52, -122.68")).toBeInTheDocument();
  });

  test("blocks submit and shows validation errors when empty", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    render(<PropertyForm onSaved={onSaved} />);

    await user.click(screen.getByRole("button", { name: /create property/i }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByText("Organization is required")).toBeInTheDocument();
    // The location error surfaces under the map even without coordinate inputs.
    expect(screen.getByText("Latitude is required")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
