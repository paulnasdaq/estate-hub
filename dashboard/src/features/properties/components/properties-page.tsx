import { Link } from "@tanstack/react-router";
import { Building2, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { useState } from "react";

import { getErrorMessage } from "@/core/errors";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  PROPERTIES_PAGE_SIZE,
  useProperties,
} from "../api/properties.queries";
import { PropertyTable } from "./property-table";

export function PropertiesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isPending, isError, error, isPlaceholderData } = useProperties({
    search: debouncedSearch || undefined,
    page,
  });

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PROPERTIES_PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = page < pageCount - 1;

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
          onChange={(event) => {
            setSearch(event.target.value);
            // A new search term restarts paging from the first page.
            setPage(0);
          }}
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
          <>
            <div className={isPlaceholderData ? "opacity-60" : undefined}>
              <PropertyTable data={data.items} />
            </div>

            {pageCount > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page + 1} of {pageCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasPrev}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasNext}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : debouncedSearch ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search />
              </EmptyMedia>
              <EmptyTitle>No properties found</EmptyTitle>
              <EmptyDescription>
                No properties match “{debouncedSearch}”. Try a different search.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2 />
              </EmptyMedia>
              <EmptyTitle>No properties yet</EmptyTitle>
              <EmptyDescription>
                Get started by adding your first property.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild size="sm">
                <Link to="/properties/new">
                  <Plus />
                  Add property
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        ))}
    </div>
  );
}
