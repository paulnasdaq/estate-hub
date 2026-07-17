import { createOpenApiHttp } from "openapi-msw";

import { config } from "@/core/config";
import type { paths } from "@/core/api/schema";

// Typed request handlers: openapi-msw checks every path, param, and response
// body against the same OpenAPI schema the client uses, so mocks can't drift
// from the contract. These defaults stand in for the backend; individual tests
// override them per-case with `server.use(...)`.
//
// Handlers share the client's base URL so their patterns match the exact origin
// the client requests (in Node/jsdom, relative paths resolve to the wrong host).
export const http = createOpenApiHttp<paths>({ baseUrl: config.apiUrl });

// A stable org id tests can reference when selecting an organization.
export const SAMPLE_ORG_ID = "11111111-1111-1111-1111-111111111111";

const now = "2026-01-01T00:00:00Z";

export const handlers = [
  http.get("/health", ({ response }) =>
    response(200).json({ status: "ok", app: "backend", environment: "test" }),
  ),

  http.get("/api/v1/organizations", ({ response }) =>
    response(200).json({
      items: [{ id: SAMPLE_ORG_ID, created_at: now, name: "Acme Properties" }],
      total: 1,
      limit: 50,
      offset: 0,
    }),
  ),

  http.post("/api/v1/organizations", async ({ request, response }) => {
    const body = await request.json();
    return response(201).json({
      id: "44444444-4444-4444-4444-444444444444",
      created_at: now,
      ...body,
    });
  }),

  http.get("/api/v1/properties", ({ response }) =>
    response(200).json({
      items: [
        {
          id: "22222222-2222-2222-2222-222222222222",
          created_at: now,
          name: "Maple Court",
          lat: 45.52,
          lng: -122.68,
          organization_id: SAMPLE_ORG_ID,
          unit_count: 3,
          occupied_unit_count: 2,
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    }),
  ),

  http.get("/api/v1/properties/{property_id}", ({ params, response }) =>
    response(200).json({
      id: params.property_id,
      created_at: now,
      name: "Maple Court",
      lat: 45.52,
      lng: -122.68,
      organization_id: SAMPLE_ORG_ID,
      unit_count: 3,
      occupied_unit_count: 2,
    }),
  ),

  http.post("/api/v1/properties", async ({ request, response }) => {
    const body = await request.json();
    return response(201).json({
      id: "33333333-3333-3333-3333-333333333333",
      created_at: now,
      // A brand-new property has no units yet.
      unit_count: 0,
      occupied_unit_count: 0,
      ...body,
    });
  }),

  http.get(
    "/api/v1/properties/{property_id}/units",
    ({ params, response }) =>
      response(200).json({
        items: [
          {
            id: "55555555-5555-5555-5555-555555555555",
            created_at: now,
            name: "Unit 1",
            price: 1200,
            property_id: params.property_id,
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      }),
  ),

  http.post(
    "/api/v1/properties/{property_id}/units",
    async ({ params, request, response }) => {
      const body = await request.json();
      return response(201).json({
        id: "66666666-6666-6666-6666-666666666666",
        created_at: now,
        property_id: params.property_id,
        ...body,
      });
    },
  ),

  http.get(
    "/api/v1/properties/{property_id}/media",
    ({ response }) =>
      response(200).json({ items: [], total: 0, limit: 50, offset: 0 }),
  ),

  http.post(
    "/api/v1/properties/{property_id}/media/presigns",
    async ({ params, request, response }) => {
      const body = await request.json();
      return response(200).json({
        storage_key: `properties/${params.property_id}/files/${body.filename}`,
        // Absolute so the raw PUT is interceptable in jsdom; tests that assert
        // the upload override this handler and add a matching PUT handler.
        upload_url: `http://s3.test/upload/${params.property_id}/${body.filename}`,
      });
    },
  ),

  http.get("/api/v1/units/{unit_id}", ({ params, response }) =>
    response(200).json({
      id: params.unit_id,
      created_at: now,
      name: "Unit 1",
      price: 1200,
      property_id: "22222222-2222-2222-2222-222222222222",
    }),
  ),

  http.get(
    "/api/v1/units/{unit_id}/media",
    ({ response }) =>
      response(200).json({ items: [], total: 0, limit: 50, offset: 0 }),
  ),

  http.post(
    "/api/v1/units/{unit_id}/media/presigns",
    async ({ params, request, response }) => {
      const body = await request.json();
      return response(200).json({
        storage_key: `units/${params.unit_id}/files/${body.filename}`,
        // Absolute so the raw PUT is interceptable in jsdom; tests that assert
        // the upload override this handler and add a matching PUT handler.
        upload_url: `http://s3.test/upload/${params.unit_id}/${body.filename}`,
      });
    },
  ),

  http.get("/api/v1/users", ({ response }) =>
    response(200).json({ items: [], total: 0, limit: 10, offset: 0 }),
  ),

  http.get("/api/v1/users/{user_id}", ({ params, response }) =>
    response(200).json({
      id: params.user_id,
      created_at: now,
      deleted_at: null,
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      phone: null,
      accounts: [
        {
          id: "99999999-9999-9999-9999-999999999999",
          created_at: now,
          organization_id: SAMPLE_ORG_ID,
        },
      ],
    }),
  ),

  http.get("/api/v1/leases", ({ response }) =>
    response(200).json({ items: [], total: 0, limit: 10, offset: 0 }),
  ),

  http.get("/api/v1/leases/{lease_id}", ({ params, response }) =>
    response(200).json({
      id: params.lease_id,
      created_at: now,
      deleted_at: null,
      unit_id: "22222222-2222-2222-2222-222222222222",
      account_id: "99999999-9999-9999-9999-999999999999",
      effective_from: now,
      terminated_on: null,
      terms: [],
    }),
  ),

  http.post("/api/v1/leases", async ({ request, response }) => {
    const { terms, ...body } = await request.json();
    return response(201).json({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      created_at: now,
      deleted_at: null,
      terminated_on: null,
      ...body,
      // Echo the submitted terms back as read models (id + timestamp added).
      terms: terms.map((term, index) => ({
        id: `bbbbbbbb-bbbb-bbbb-bbbb-${String(index).padStart(12, "0")}`,
        created_at: now,
        deleted_at: null,
        ...term,
      })),
    });
  }),

  http.get("/api/v1/bills", ({ response }) =>
    response(200).json({ items: [], total: 0, limit: 10, offset: 0 }),
  ),

  http.get("/api/v1/payments", ({ response }) =>
    response(200).json({ items: [], total: 0, limit: 10, offset: 0 }),
  ),

  http.get("/api/v1/leases/{lease_id}/bills", ({ response }) =>
    response(200).json({ items: [], total: 0, limit: 10, offset: 0 }),
  ),

  http.get("/api/v1/bills/{bill_id}", ({ params, response }) =>
    response(200).json({
      id: params.bill_id,
      created_at: now,
      deleted_at: null,
      lease_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      date: "2026-02-01",
      items: [],
    }),
  ),

  http.post("/api/v1/bills", async ({ request, response }) => {
    const { items, ...body } = await request.json();
    return response(201).json({
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      created_at: now,
      deleted_at: null,
      ...body,
      // Echo the submitted items back as read models (id + timestamp added).
      items: items.map((item, index) => ({
        id: `dddddddd-dddd-dddd-dddd-${String(index).padStart(12, "0")}`,
        created_at: now,
        deleted_at: null,
        ...item,
      })),
    });
  }),

  http.post("/api/v1/users", async ({ request, response }) => {
    const body = await request.json();
    return response(201).json({
      id: "88888888-8888-8888-8888-888888888888",
      created_at: now,
      deleted_at: null,
      accounts: [
        {
          id: "99999999-9999-9999-9999-999999999999",
          created_at: now,
          organization_id: body.organization_id,
        },
      ],
      ...body,
    });
  }),

  http.post("/api/v1/media", async ({ request, response }) => {
    const body = await request.json();
    return response(201).json({
      id: "77777777-7777-7777-7777-777777777777",
      created_at: now,
      deleted_at: null,
      ...body,
    });
  }),
];
