import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { getErrorMessage } from "@/core/errors";
import { Button } from "@/components/ui/button";
import { useProperties } from "../api/properties.queries";
import { PropertyTable } from "./property-table";

export function PropertiesPage() {
  const { data, isPending, isError, error } = useProperties();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
        <Button asChild size="sm">
          <Link to="/properties/new">
            <Plus />
            Add property
          </Link>
        </Button>
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading properties…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}
      {data && <PropertyTable data={data.items} />}
    </div>
  );
}
