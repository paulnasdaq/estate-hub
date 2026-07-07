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
    }),
  ),

  http.post("/api/v1/properties", async ({ request, response }) => {
    const body = await request.json();
    return response(201).json({
      id: "33333333-3333-3333-3333-333333333333",
      created_at: now,
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
];
