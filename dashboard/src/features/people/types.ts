import type { components } from "@/core/api/schema";

// Domain types sourced from the OpenAPI schema, so they stay in sync with the
// backend (regenerate with `npm run gen:api`). The backend calls this resource
// "users"; the dashboard surfaces it as "People".
export type Person = components["schemas"]["UserRead"];
export type PersonCreate = components["schemas"]["UserCreate"];
