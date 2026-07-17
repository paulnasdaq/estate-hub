import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";

import type { Payment } from "../types";

const columnHelper = createColumnHelper<Payment>();

const formatDate = (value: string) => new Date(value).toLocaleDateString();

// Payment amounts are stored as whole units of currency (no cents).
const amountFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

// Truncate a uuid to its first segment so the table stays readable until
// payment requests expose a human-friendly label to join against.
const shortId = (id: string) => id.split("-")[0];

const columns = [
  columnHelper.accessor("created_at", {
    header: "Date",
    cell: (info) => formatDate(info.getValue()),
  }),
  columnHelper.accessor("amount", {
    header: "Amount",
    cell: (info) => amountFormatter.format(info.getValue()),
  }),
  columnHelper.accessor("payment_request_id", {
    header: "Payment request",
    cell: (info) => (
      <span className="font-mono text-xs text-muted-foreground">
        {shortId(info.getValue())}
      </span>
    ),
  }),
];

export function PaymentsTable({ data }: { data: Payment[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="cursor-pointer px-4 py-3 text-left font-medium select-none"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                  {{ asc: " ↑", desc: " ↓" }[
                    header.column.getIsSorted() as string
                  ] ?? null}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
