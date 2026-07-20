import type { components } from "@/core/api/schema";

// Domain types sourced from the OpenAPI schema, so they stay in sync with the
// backend (regenerate with `npm run gen:api`).
export type Organization = components["schemas"]["OrganizationRead"];
export type OrganizationCreate = components["schemas"]["OrganizationCreate"];
export type OrganizationUpdate = components["schemas"]["OrganizationUpdate"];
