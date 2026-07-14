import type { components } from "@/core/api/schema";

// Domain types sourced from the OpenAPI schema, so they stay in sync with the
// backend (regenerate with `npm run gen:api`).
export type Bill = components["schemas"]["BillRead"];
export type BillCreate = components["schemas"]["BillCreate"];
export type BillItem = components["schemas"]["BillItemRead"];
