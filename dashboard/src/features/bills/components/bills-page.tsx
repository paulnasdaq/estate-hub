import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";

import { getErrorMessage } from "@/core/errors";
import { Button } from "@/components/ui/button";
import { BILLS_PAGE_SIZE, useBills } from "../api/bills.queries";
import { BillTable } from "./bill-table";

export function BillsPage() {
  const [page, setPage] = useState(0);

  const { data, isPending, isError, error, isPlaceholderData } = useBills({
    page,
  });

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / BILLS_PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = page < pageCount - 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>
        <Button asChild size="sm">
          <Link to="/bills/new">
            <Plus />
            Add bill
          </Link>
        </Button>
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading bills…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}
      {data &&
        (data.items.length > 0 ? (
          <>
            <div className={isPlaceholderData ? "opacity-60" : undefined}>
              <BillTable data={data.items} />
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
          <p className="text-sm text-muted-foreground">No bills yet.</p>
        ))}
    </div>
  );
}
