import type { components } from "@/core/api/schema";

// Domain types sourced from the OpenAPI schema, so they stay in sync with the
// backend (regenerate with `npm run gen:api`).
export type Property = components["schemas"]["PropertyRead"];
export type PropertyCreate = components["schemas"]["PropertyCreate"];
export type PropertyUpdate = components["schemas"]["PropertyUpdate"];

// Units are always scoped to a property (see the nested API routes).
export type Unit = components["schemas"]["UnitRead"];
export type UnitCreateNested = components["schemas"]["UnitCreateNested"];

// Media is polymorphic on the backend; the dashboard only attaches it to
// properties today (entity_type: "property").
export type Media = components["schemas"]["MediaRead"];
// A media row enriched with a presigned download URL, as returned by the
// property media listing endpoint.
export type MediaWithUrl = components["schemas"]["MediaWithUrl"];
