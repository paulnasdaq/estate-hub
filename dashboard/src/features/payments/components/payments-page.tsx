import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { getErrorMessage } from "@/core/errors";
import { Button } from "@/components/ui/button";
import { PAYMENTS_PAGE_SIZE, usePayments } from "../api/payments.queries";
import { PaymentsTable } from "./payments-table";

export function PaymentsPage() {
  const [page, setPage] = useState(0);

  const { data, isPending, isError, error, isPlaceholderData } = usePayments({
    page,
  });

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PAYMENTS_PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = page < pageCount - 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading payments…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}
      {data &&
        (data.items.length > 0 ? (
          <>
            <div className={isPlaceholderData ? "opacity-60" : undefined}>
              <PaymentsTable data={data.items} />
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
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        ))}
    </div>
  );
}
