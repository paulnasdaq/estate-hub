import { Link } from "@tanstack/react-router";
import { ArrowLeft, Pencil } from "lucide-react";

import { getErrorMessage } from "@/core/errors";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganization } from "../api/organizations.queries";

const formatDate = (value: string) => new Date(value).toLocaleDateString();

// Detail page for a single organization at /organizations/$orgId. Kept
// prop-driven (takes the org id) so it can be tested without a router.
export function OrganizationDetailsPage({ orgId }: { orgId: string }) {
  const { data: organization, isPending, isError, error } =
    useOrganization(orgId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/organizations"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to organizations
          </Link>
          {isPending && <Skeleton className="h-8 w-48" />}
          {isError && (
            <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
          )}
          {organization && (
            <div className="flex items-center gap-3">
              {organization.logo_url && (
                <img
                  src={organization.logo_url}
                  alt={`${organization.name} logo`}
                  className="size-10 rounded-md border object-cover"
                />
              )}
              <h1 className="text-2xl font-semibold tracking-tight">
                {organization.name}
              </h1>
            </div>
          )}
        </div>
        {organization && (
          <Button asChild variant="outline" size="sm">
            <Link to="/organizations/$orgId/edit" params={{ orgId }}>
              <Pencil />
              Edit
            </Link>
          </Button>
        )}
      </div>

      {organization && (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 rounded-lg border p-6 sm:grid-cols-2">
          <Detail label="Name">{organization.name}</Detail>
          <Detail label="Email">
            {organization.email ? (
              <a
                href={`mailto:${organization.email}`}
                className="text-primary hover:underline"
              >
                {organization.email}
              </a>
            ) : (
              "—"
            )}
          </Detail>
          <Detail label="Phone">
            {organization.phone ? (
              <a
                href={`tel:${organization.phone}`}
                className="text-primary hover:underline"
              >
                {organization.phone}
              </a>
            ) : (
              "—"
            )}
          </Detail>
          <Detail label="Website">
            {organization.website ? (
              <a
                href={organization.website}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {organization.website}
              </a>
            ) : (
              "—"
            )}
          </Detail>
          <Detail label="Created">
            {formatDate(organization.created_at)}
          </Detail>
        </dl>
      )}
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
