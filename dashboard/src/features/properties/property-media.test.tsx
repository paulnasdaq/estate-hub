import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { render, screen, waitFor } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { PropertyMedia } from "./components/property-media";

const PROPERTY_ID = "22222222-2222-2222-2222-222222222222";
const now = "2026-01-01T00:00:00Z";

function mediaItem(overrides: Record<string, unknown>) {
  return {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    created_at: now,
    deleted_at: null,
    entity_type: "property",
    entity_id: PROPERTY_ID,
    content_type: "image/jpeg",
    size_bytes: 1024,
    is_primary: false,
    display_order: 0,
    ...overrides,
  };
}

describe("PropertyMedia", () => {
  test("renders images as a grid of thumbnails", async () => {
    server.use(
      http.get("*/api/v1/properties/:propertyId/media", () =>
        HttpResponse.json({
          items: [
            mediaItem({
              id: "img-1",
              storage_key: `properties/${PROPERTY_ID}/images/kitchen.jpg`,
              url: "http://s3.test/kitchen.jpg",
            }),
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
    );

    render(<PropertyMedia propertyId={PROPERTY_ID} />);

    const img = await screen.findByRole("img", { name: "kitchen.jpg" });
    expect(img).toHaveAttribute("src", "http://s3.test/kitchen.jpg");
  });

  test("renders non-images as a labelled file tile", async () => {
    server.use(
      http.get("*/api/v1/properties/:propertyId/media", () =>
        HttpResponse.json({
          items: [
            mediaItem({
              id: "doc-1",
              content_type: "application/pdf",
              storage_key: `properties/${PROPERTY_ID}/files/lease.pdf`,
              url: "http://s3.test/lease.pdf",
            }),
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      ),
    );

    render(<PropertyMedia propertyId={PROPERTY_ID} />);

    // No thumbnail — the file name is shown as a label instead.
    expect(await screen.findByText("lease.pdf")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("shows an empty state when there is no media", async () => {
    // Uses the default empty media handler.
    render(<PropertyMedia propertyId={PROPERTY_ID} />);

    expect(await screen.findByText("No media yet.")).toBeInTheDocument();
  });

  test("pages through media by offset", async () => {
    // A page of 12 tiles per request; the server pages by the offset query.
    server.use(
      http.get(
        "*/api/v1/properties/:propertyId/media",
        ({ request }) => {
          const offset = Number(
            new URL(request.url).searchParams.get("offset") ?? "0",
          );
          const index = offset === 0 ? 0 : 1;
          return HttpResponse.json({
            items: [
              mediaItem({
                id: `img-${index}`,
                storage_key: `properties/${PROPERTY_ID}/images/photo-${index}.jpg`,
                url: `http://s3.test/photo-${index}.jpg`,
              }),
            ],
            total: 13, // spills onto a second page (page size is 12)
            limit: 12,
            offset,
          });
        },
      ),
    );

    const user = userEvent.setup();
    render(<PropertyMedia propertyId={PROPERTY_ID} />);

    expect(
      await screen.findByRole("img", { name: "photo-0.jpg" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    const prev = screen.getByRole("button", { name: /previous/i });
    expect(prev).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(
      await screen.findByRole("img", { name: "photo-1.jpg" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /next/i })).toBeDisabled(),
    );
  });
});
