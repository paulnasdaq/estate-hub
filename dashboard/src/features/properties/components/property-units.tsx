import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { getErrorMessage } from "@/core/errors";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UNITS_PAGE_SIZE, usePropertyUnits } from "../api/units.queries";

// Format an integer price as currency for display in the units list.
const priceFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// The units section shown on the property units page: a searchable, paginated
// list of the property's units. Adding a unit lives on its own page (see
// NewUnitPage), so this component stays prop-driven and router-free for easy
// testing.
export function PropertyUnits({ propertyId }: { propertyId: string }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isPending, isError, error, isPlaceholderData } =
    usePropertyUnits(propertyId, {
      search: debouncedSearch || undefined,
      page,
    });

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / UNITS_PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = page < pageCount - 1;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">Units</h2>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search units by name…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            // A new search term restarts paging from the first page.
            setPage(0);
          }}
          aria-label="Search units by name"
          className="pl-9"
        />
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading units…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}
      {data &&
        (data.items.length > 0 ? (
          <>
            <ul
              className={cn(
                "divide-y rounded-lg border",
                // Dim the list while the next page/search is still loading.
                isPlaceholderData && "opacity-60",
              )}
            >
              {data.items.map((unit) => (
                <li key={unit.id}>
                  <Link
                    to="/properties/$propertyId/units/$unitId"
                    params={{ propertyId, unitId: unit.id }}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-accent/50"
                  >
                    <span>{unit.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium tabular-nums">
                        {priceFormatter.format(unit.price)}
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

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
        ) : (
          <p className="text-sm text-muted-foreground">
            {debouncedSearch
              ? `No units match “${debouncedSearch}”.`
              : "No units yet."}
          </p>
        ))}
    </section>
  );
}
