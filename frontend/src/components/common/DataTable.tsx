"use client";

import type { Table as TanStackTable } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loading } from "@/components/ui/loading";
import { Fragment } from "react";

interface DataTableProps<TData> {
  table: TanStackTable<TData>;
  loading?: boolean;
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  renderExpandedRow?: (row: TData) => React.ReactNode;
}

export function DataTable<TData>({
  table,
  loading = false,
  emptyIcon,
  emptyTitle = "Tidak ada data",
  emptyDescription = "Data yang Anda cari tidak ditemukan",
  renderExpandedRow,
}: DataTableProps<TData>) {
  if (loading) {
    return (
      <div className="py-16">
        <Loading variant="section" />
      </div>
    );
  }

  const rows = table.getRowModel().rows;

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center">
        {emptyIcon && (
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
            {emptyIcon}
          </div>
        )}
        <p className="font-medium text-gray-500">{emptyTitle}</p>
        <p className="mt-1 text-sm text-gray-400">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow
            key={headerGroup.id}
            className="bg-gray-50/50 hover:bg-gray-50/50"
          >
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className="font-semibold text-gray-700"
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <Fragment key={row.id}>
            <TableRow data-state={row.getIsSelected() && "selected"}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
            {renderExpandedRow && row.getIsExpanded() && (
              <TableRow key={`${row.id}-expanded`} className="bg-gray-50/30">
                <TableCell
                  colSpan={row.getVisibleCells().length}
                  className="p-0"
                >
                  {renderExpandedRow(row.original)}
                </TableCell>
              </TableRow>
            )}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
