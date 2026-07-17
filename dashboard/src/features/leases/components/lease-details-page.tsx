import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { getErrorMessage } from "@/core/errors";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BILLS_PAGE_SIZE, useLeaseBills } from "@/features/bills";
import { useLease } from "../api/leases.queries";
import { INTERVAL_LABELS, PAYMENT_LABELS, RATE_LABELS } from "../schemas";
import type { Lease } from "../types";

const formatDate = (value: string) => new Date(value).toLocaleDateString();

// Lease term amounts are stored as whole units of currency (no cents).
const amountFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// Truncate a uuid to its first segment, matching the lease table, until units
// and accounts expose a human-friendly label to join against.
const shortId = (id: string) => id.split("-")[0];

// Detail page for a single lease at /leases/$leaseId: its dates, unit/account,
// status, and the recurring charges (terms) attached to it. Kept prop-driven
// (takes the lease id) so it can be tested without a router.
export function LeaseDetailsPage({ leaseId }: { leaseId: string }) {
  const { data: lease, isPending, isError, error } = useLease(leaseId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/leases"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to leases
        </Link>
        {isPending && <Skeleton className="h-8 w-48" />}
        {isError && (
          <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
        )}
        {lease && (
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">Lease</h1>
            <StatusBadge lease={lease} />
          </div>
        )}
      </div>

      {lease && (
        <>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 rounded-lg border p-6 sm:grid-cols-2">
            <Detail label="Effective from">
              {formatDate(lease.effective_from)}
            </Detail>
            <Detail label="Ends">
              {lease.terminated_on ? formatDate(lease.terminated_on) : "—"}
            </Detail>
            <Detail label="Unit">
              <span className="font-mono text-xs">{shortId(lease.unit_id)}</span>
            </Detail>
            <Detail label="Account">
              <span className="font-mono text-xs">
                {shortId(lease.account_id)}
              </span>
            </Detail>
            <Detail label="Created">{formatDate(lease.created_at)}</Detail>
          </dl>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Terms</h2>
            {lease.terms.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recurring charges on this lease.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left font-medium">
                        Interval
                      </th>
                      <th className="px-4 py-3 text-left font-medium">Rate</th>
                      <th className="px-4 py-3 text-left font-medium">
                        Payment
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lease.terms.map((term) => (
                      <tr key={term.id} className="border-b last:border-0">
                        <td className="px-4 py-3">{term.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {amountFormatter.format(term.amount)}
                        </td>
                        <td className="px-4 py-3">
                          {INTERVAL_LABELS[term.interval]}
                        </td>
                        <td className="px-4 py-3">{RATE_LABELS[term.rate]}</td>
                        <td className="px-4 py-3">
                          {PAYMENT_LABELS[term.type]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <LeaseBillsSection leaseId={leaseId} />
        </>
      )}
    </div>
  );
}

// Bills raised against this lease, paginated the same way as the standalone
// bills list. Kept in the details page (rather than the shared BillTable) so it
// can drop the redundant lease column and show a per-bill total instead.
function LeaseBillsSection({ leaseId }: { leaseId: string }) {
  const [page, setPage] = useState(0);
  const { data, isPending, isError, error, isPlaceholderData } = useLeaseBills(
    leaseId,
    { page },
  );

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / BILLS_PAGE_SIZE);
  const hasPrev = page > 0;
  const hasNext = page < pageCount - 1;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Bills</h2>
      {isPending && (
        <p className="text-sm text-muted-foreground">Loading bills…</p>
      )}
      {isError && (
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
      )}
      {data &&
        (data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No bills for this lease yet.
          </p>
        ) : (
          <>
            <div
              className={
                "overflow-x-auto rounded-lg border" +
                (isPlaceholderData ? " opacity-60" : "")
              }
            >
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((bill) => (
                    <tr key={bill.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          to="/bills/$billId"
                          params={{ billId: bill.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {formatDate(bill.date)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {amountFormatter.format(
                          bill.items.reduce((sum, item) => sum + item.amount, 0),
                        )}
                      </td>
                      <td className="px-4 py-3">{formatDate(bill.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
        ))}
    </section>
  );
}

function StatusBadge({ lease }: { lease: Lease }) {
  const terminated = Boolean(lease.terminated_on);
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium " +
        (terminated
          ? "bg-muted text-muted-foreground"
          : "bg-primary/10 text-primary")
      }
    >
      {terminated ? "Terminated" : "Active"}
    </span>
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
