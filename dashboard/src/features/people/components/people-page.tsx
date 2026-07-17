import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus, Search, Users } from "lucide-react";
import { useState } from "react";

import { getErrorMessage } from "@/core/errors";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PEOPLE_PAGE_SIZE, usePeople } from "../api/people.queries";
import { PeopleTable } from "./people-table";

export function PeoplePage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isPending, isError, error, isPlaceholderData } = usePeople({
    search: debouncedSearch || undefined,
    page,
  });

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PEOPLE_PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = page < pageCount - 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <Button asChild size="sm">
          <Link to="/people/new">
            <Plus />
            Add person
          </Link>
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search people by name or email…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            // A new search term restarts paging from the first page.
            setPage(0);
          }}
          aria-label="Search people by name or email"
          className="pl-9"
        />
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading people…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}
      {data &&
        (data.items.length > 0 ? (
          <>
            <div className={isPlaceholderData ? "opacity-60" : undefined}>
              <PeopleTable data={data.items} />
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
          <p className="text-sm text-muted-foreground">
            No people match “{debouncedSearch}”.
          </p>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No people yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add your first person to get started.
            </p>
          </div>
        ))}
    </div>
  );
}
