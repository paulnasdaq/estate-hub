import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { getErrorMessage } from "@/core/errors";
import { Skeleton } from "@/components/ui/skeleton";
import { useBill } from "../api/bills.queries";

const formatDate = (value: string) => new Date(value).toLocaleDateString();

// Bill item amounts are stored as whole units of currency (no cents).
const amountFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// Truncate a uuid to its first segment, matching the bill table, until leases
// expose a human-friendly label to join against.
const shortId = (id: string) => id.split("-")[0];

// Detail page for a single bill at /bills/$billId: its date, the lease it
// belongs to, and the line items (each with its own service period) attached to
// it. Kept prop-driven (takes the bill id) so it can be tested without a router.
export function BillDetailsPage({ billId }: { billId: string }) {
  const { data: bill, isPending, isError, error } = useBill(billId);

  const total = bill?.items.reduce((sum, item) => sum + item.amount, 0) ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link
          to="/bills"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to bills
        </Link>
        {isPending && <Skeleton className="h-8 w-48" />}
        {isError && (
          <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
        )}
        {bill && (
          <h1 className="text-2xl font-semibold tracking-tight">Bill</h1>
        )}
      </div>

      {bill && (
        <>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 rounded-lg border p-6 sm:grid-cols-2">
            <Detail label="Date">{formatDate(bill.date)}</Detail>
            <Detail label="Lease">
              <span className="font-mono text-xs">{shortId(bill.lease_id)}</span>
            </Detail>
            <Detail label="Created">{formatDate(bill.created_at)}</Detail>
          </dl>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Items</h2>
            {bill.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No line items on this bill.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">
                        Period
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-4 py-3">{item.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(item.start_date)} –{" "}
                          {formatDate(item.end_date)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {amountFormatter.format(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t bg-muted/50">
                    <tr>
                      <td className="px-4 py-3 font-medium" colSpan={2}>
                        Total
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {amountFormatter.format(total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
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
