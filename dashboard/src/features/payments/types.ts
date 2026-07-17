import type { components } from "@/core/api/schema";

// Domain types sourced from the OpenAPI schema, so they stay in sync with the
// backend (regenerate with `npm run gen:api`). A payment is a single collection
// recorded against a payment request.
export type Payment = components["schemas"]["PaymentRead"];
