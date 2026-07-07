import type { components } from "@/core/api/schema";

// Domain types sourced from the OpenAPI schema, so they stay in sync with the
// backend (regenerate with `npm run gen:api`).
export type Property = components["schemas"]["PropertyRead"];
export type PropertyCreate = components["schemas"]["PropertyCreate"];

// Units are always scoped to a property (see the nested API routes).
export type Unit = components["schemas"]["UnitRead"];
export type UnitCreateNested = components["schemas"]["UnitCreateNested"];
