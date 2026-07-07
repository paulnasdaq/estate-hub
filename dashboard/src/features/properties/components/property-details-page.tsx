import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { getErrorMessage } from "@/core/errors";
import { useOrganizations } from "@/features/organizations";
import { useProperty } from "../api/properties.queries";

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

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading property…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}

      {property && (
        <dl className="grid grid-cols-1 gap-4 rounded-lg border p-6 sm:grid-cols-2">
          <Field label="Name" value={property.name} />
          <Field
            label="Organization"
            value={organizationName ?? property.organization_id}
          />
          <Field label="Latitude" value={property.lat} />
          <Field label="Longitude" value={property.lng} />
          <Field
            label="Created"
            value={new Date(property.created_at).toLocaleString()}
          />
        </dl>
      )}
    </div>
  );
}
