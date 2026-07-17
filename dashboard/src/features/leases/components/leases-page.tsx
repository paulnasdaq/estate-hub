import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus, ScrollText } from "lucide-react";
import { useState } from "react";

import { getErrorMessage } from "@/core/errors";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { LEASES_PAGE_SIZE, useLeases } from "../api/leases.queries";
import { LeaseTable } from "./lease-table";

export function LeasesPage() {
  const [page, setPage] = useState(0);

  const { data, isPending, isError, error, isPlaceholderData } = useLeases({
    page,
  });

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / LEASES_PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = page < pageCount - 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Leases</h1>
        <Button asChild size="sm">
          <Link to="/leases/new">
            <Plus />
            Add lease
          </Link>
        </Button>
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading leases…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}
      {data &&
        (data.items.length > 0 ? (
          <>
            <div className={isPlaceholderData ? "opacity-60" : undefined}>
              <LeaseTable data={data.items} />
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
        ) : (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ScrollText />
              </EmptyMedia>
              <EmptyTitle>No leases yet</EmptyTitle>
              <EmptyDescription>
                Get started by adding your first lease.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild size="sm">
                <Link to="/leases/new">
                  <Plus />
                  Add lease
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        ))}
    </div>
  );
}
