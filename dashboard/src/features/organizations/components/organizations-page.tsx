import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { getErrorMessage } from "@/core/errors";
import { Button } from "@/components/ui/button";
import { useOrganizations } from "../api/organizations.queries";
import { OrganizationTable } from "./organization-table";

export function OrganizationsPage() {
  const { data, isPending, isError, error } = useOrganizations();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <Button asChild size="sm">
          <Link to="/organizations/new">
            <Plus />
            Add organization
          </Link>
        </Button>
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading organizations…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}
      {data && <OrganizationTable data={data.items} />}
    </div>
  );
}
