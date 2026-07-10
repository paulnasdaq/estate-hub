import { lazy, Suspense } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, DoorOpen, Pencil } from "lucide-react";

import { getErrorMessage } from "@/core/errors";
import { useOrganizations } from "@/features/organizations";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProperty } from "../api/properties.queries";
import { EntityMedia } from "./entity-media";

// Lazy-loaded so the sizeable mapbox-gl bundle is only fetched on this page,
// not eagerly in the main app chunk.
const PropertyMap = lazy(() =>
  import("./property-map").then((m) => ({ default: m.PropertyMap })),
);

// A single labelled field in the details grid.
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export function PropertyDetailsPage({ propertyId }: { propertyId: string }) {
  const { data: property, isPending, isError, error } = useProperty(propertyId);
  // Organizations have no get-by-id here; resolve the name from the list, which
  // is already cached by the properties/organizations pages.
  const organizations = useOrganizations();

  const organizationName = organizations.data?.items.find(
    (org) => org.id === property?.organization_id,
  )?.name;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/properties"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to properties
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {property?.name ?? "Property"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/properties/$propertyId/edit" params={{ propertyId }}>
              <Pencil />
              Edit
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/properties/$propertyId/units" params={{ propertyId }}>
              <DoorOpen />
              Units
            </Link>
          </Button>
        </div>
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading property…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}

      {property && (
        <>
          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
              <p className="text-sm text-muted-foreground">
                Key details about this property.
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-4 rounded-lg border p-6 sm:grid-cols-2">
              <Field label="Name" value={property.name} />
              <Field
                label="Organization"
                value={organizationName ?? property.organization_id}
              />
              <Field
                label="Created"
                value={new Date(property.created_at).toLocaleString()}
              />
            </dl>
          </section>

          <section className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">Address</h2>
              <p className="text-sm text-muted-foreground">
                Where this property is located.
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-4 rounded-lg border p-6 sm:grid-cols-2">
              <Field label="Latitude" value={property.lat} />
              <Field label="Longitude" value={property.lng} />
            </dl>
            <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
              <PropertyMap
                lat={property.lat}
                lng={property.lng}
                name={property.name}
              />
            </Suspense>
          </section>

          <EntityMedia
            entityType="property"
            entityId={propertyId}
            description="Photos and documents for this property."
          />
        </>
      )}
    </div>
  );
}
