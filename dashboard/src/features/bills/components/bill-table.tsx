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

import type { Bill } from "../types";

const columnHelper = createColumnHelper<Bill>();

const formatDate = (value: string) => new Date(value).toLocaleDateString();

// Truncate a uuid to its first segment so the table stays readable until leases
// expose a human-friendly label to join against.
const shortId = (id: string) => id.split("-")[0];

const columns = [
  columnHelper.accessor("date", {
    header: "Date",
    cell: (info) => (
      <Link
        to="/bills/$billId"
        params={{ billId: info.row.original.id }}
        className="font-medium text-primary hover:underline"
      >
        {formatDate(info.getValue())}
      </Link>
    ),
  }),
  columnHelper.accessor("lease_id", {
    header: "Lease",
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

export function BillTable({ data }: { data: Bill[] }) {
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
