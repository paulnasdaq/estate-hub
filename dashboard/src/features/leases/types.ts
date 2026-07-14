import type { components } from "@/core/api/schema";

// Domain types sourced from the OpenAPI schema, so they stay in sync with the
// backend (regenerate with `npm run gen:api`).
export type Lease = components["schemas"]["LeaseRead"];
export type LeaseCreate = components["schemas"]["LeaseCreate"];
