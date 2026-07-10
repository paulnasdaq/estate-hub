import { Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil } from "lucide-react";

import { getErrorMessage } from "@/core/errors";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnit } from "../api/units.queries";
import { EntityMedia } from "./entity-media";

// Formats an integer price as currency, matching the units list.
const priceFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// Detail page for a single unit at /properties/$propertyId/units/$unitId: the
// unit's name/price plus its media section. Kept prop-driven (takes the
// property + unit ids) so it can be tested without a router.
export function UnitDetailsPage({
  propertyId,
  unitId,
}: {
  propertyId: string;
  unitId: string;
}) {
  const { data: unit, isPending, isError, error } = useUnit(unitId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/properties/$propertyId/units"
          params={{ propertyId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to units
        </Link>
        {isPending && <Skeleton className="h-8 w-48" />}
        {isError && (
          <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
        )}
        {unit && (
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">
              {unit.name}
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-lg font-medium tabular-nums text-muted-foreground">
                {priceFormatter.format(unit.price)}
              </span>
              <Button asChild variant="outline" size="sm">
                <Link
                  to="/properties/$propertyId/units/$unitId/edit"
                  params={{ propertyId, unitId }}
                >
                  <Pencil />
                  Edit
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      {unit && (
        <EntityMedia
          entityType="unit"
          entityId={unitId}
          description="Photos and documents for this unit."
        />
      )}
    </div>
  );
}
