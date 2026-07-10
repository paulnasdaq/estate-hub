import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { useProperty } from "../api/properties.queries";
import { UnitForm } from "./unit-form";

// Dedicated page for adding a unit to a property at
// /properties/$propertyId/units/new. Kept prop-driven (takes the property id)
// so it can be tested without a router, mirroring NewPropertyPage.
export function NewUnitPage({ propertyId }: { propertyId: string }) {
  const navigate = useNavigate();
  const { data: property } = useProperty(propertyId);

  const backToUnits = () =>
    navigate({ to: "/properties/$propertyId/units", params: { propertyId } });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/properties/$propertyId/units"
          params={{ propertyId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to units
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New unit</h1>
        {property && (
          <p className="text-sm text-muted-foreground">
            Adding a unit to {property.name}.
          </p>
        )}
      </div>

      <UnitForm
        propertyId={propertyId}
        onSaved={backToUnits}
        onCancel={backToUnits}
      />
    </div>
  );
}
