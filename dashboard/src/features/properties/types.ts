import type { components } from "@/core/api/schema";

// Domain types sourced from the OpenAPI schema, so they stay in sync with the
// backend (regenerate with `npm run gen:api`).
export type Property = components["schemas"]["PropertyRead"];
export type PropertyCreate = components["schemas"]["PropertyCreate"];
export type PropertyUpdate = components["schemas"]["PropertyUpdate"];
export type PropertyCategory = components["schemas"]["PropertyCategory"];

// Category options with display labels, in the order they appear in the form.
export const PROPERTY_CATEGORIES: {
  value: PropertyCategory;
  label: string;
}[] = [
  { value: "commercial", label: "Commercial" },
  { value: "residential", label: "Residential" },
];

// Map a stored category to its human label (falls back to "—" when unset).
export function propertyCategoryLabel(
  category: PropertyCategory | null | undefined,
): string {
  return (
    PROPERTY_CATEGORIES.find((c) => c.value === category)?.label ?? "—"
  );
}

// Units are always scoped to a property (see the nested API routes).
export type Unit = components["schemas"]["UnitRead"];
export type UnitCreateNested = components["schemas"]["UnitCreateNested"];
export type UnitUpdate = components["schemas"]["UnitUpdate"];

// Media is polymorphic on the backend; the dashboard only attaches it to
// properties today (entity_type: "property").
export type Media = components["schemas"]["MediaRead"];
// A media row enriched with a presigned download URL, as returned by the
// property media listing endpoint.
export type MediaWithUrl = components["schemas"]["MediaWithUrl"];
