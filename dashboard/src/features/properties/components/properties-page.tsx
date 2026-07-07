import { Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useState } from "react";

import { getErrorMessage } from "@/core/errors";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProperties } from "../api/properties.queries";
import { PropertyTable } from "./property-table";

export function PropertiesPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim());
  const { data, isPending, isError, error } = useProperties({
    search: debouncedSearch || undefined,
  });

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

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search properties by name…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search properties by name"
          className="pl-9"
        />
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading properties…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}
      {data &&
        (data.items.length > 0 ? (
          <PropertyTable data={data.items} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {debouncedSearch
              ? `No properties match “${debouncedSearch}”.`
              : "No properties yet."}
          </p>
        ))}
    </div>
  );
}
