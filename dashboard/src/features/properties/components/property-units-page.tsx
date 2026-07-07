import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { useProperty } from "../api/properties.queries";
import { PropertyUnits } from "./property-units";

// Dedicated page for a property's units at /properties/$propertyId/units. Kept
// prop-driven (takes the property id) so it can be tested without a router.
export function PropertyUnitsPage({ propertyId }: { propertyId: string }) {
  const { data: property } = useProperty(propertyId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/properties/$propertyId"
          params={{ propertyId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to property
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {property?.name ?? "Property"}
        </h1>
      </div>

      <PropertyUnits propertyId={propertyId} />
    </div>
  );
}
