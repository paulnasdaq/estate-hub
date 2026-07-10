import { Link } from "@tanstack/react-router";
import { ArrowLeft, Plus } from "lucide-react";

import { useProperty } from "../api/properties.queries";
import { Button } from "@/components/ui/button";
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
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {property?.name ?? "Property"}
          </h1>
          <Button asChild>
            <Link
              to="/properties/$propertyId/units/new"
              params={{ propertyId }}
            >
              <Plus />
              Add unit
            </Link>
          </Button>
        </div>
      </div>

      <PropertyUnits propertyId={propertyId} />
    </div>
  );
}
