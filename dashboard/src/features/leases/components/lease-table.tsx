import { Link } from "@tanstack/react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";

import type { Lease } from "../types";

const columnHelper = createColumnHelper<Lease>();

const formatDate = (value: string) => new Date(value).toLocaleDateString();

// Truncate a uuid to its first segment so the table stays readable until units
// and accounts expose a human-friendly label to join against.
const shortId = (id: string) => id.split("-")[0];

const columns = [
  columnHelper.accessor("effective_from", {
    header: "Effective from",
    cell: (info) => (
      <Link
        to="/leases/$leaseId"
        params={{ leaseId: info.row.original.id }}
        className="font-medium text-primary hover:underline"
      >
        {formatDate(info.getValue())}
      </Link>
    ),
  }),
  columnHelper.accessor("terminated_on", {
    header: "Status",
    cell: (info) => {
      const terminatedOn = info.getValue();
      return terminatedOn
        ? `Terminated ${formatDate(terminatedOn)}`
        : "Active";
    },
  }),
  columnHelper.accessor("unit_id", {
    header: "Unit",
    cell: (info) => (
      <span className="font-mono text-xs text-muted-foreground">
        {shortId(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor("account_id", {
    header: "Account",
    cell: (info) => (
      <span className="font-mono text-xs text-muted-foreground">
        {shortId(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor("created_at", {
    header: "Created",
    cell: (info) => formatDate(info.getValue()),
  }),
];

export function LeaseTable({ data }: { data: Lease[] }) {
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
