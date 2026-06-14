"use client";

import type { Table as TanStackTable } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";

interface DataTablePaginationProps<TData> {
  table: TanStackTable<TData>;
  pageSizeOptions?: number[];
  className?: string;
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 25, 50],
  className,
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const totalItems = table.getFilteredRowModel().rows.length;
  const totalPages = table.getPageCount();
  const currentPage = pageIndex + 1;

  const showingStart = totalItems === 0 ? 0 : pageIndex * pageSize + 1;
  const showingEnd = Math.min((pageIndex + 1) * pageSize, totalItems);

  // Calculate visible page numbers (centered around current)
  const visiblePages = 3;
  const halfVisible = Math.floor(visiblePages / 2);
  let startPage = Math.max(1, currentPage - halfVisible);
  const endPage = Math.min(totalPages, startPage + visiblePages - 1);
  if (endPage - startPage + 1 < visiblePages) {
    startPage = Math.max(1, endPage - visiblePages + 1);
  }

  const pageNumbers = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-4 border-t px-6 py-4 sm:flex-row",
        className
      )}
    >
      <div className="flex flex-1 items-center gap-4">
        <div className="flex h-9 items-center overflow-hidden rounded-lg border">
          <span className="text-grey-900 bg-white px-2 text-sm tracking-tight">
            Per page
          </span>
          <div className="h-full border-l">
            <Select
              value={String(pageSize)}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger className="text-grey-900 h-full gap-1.5 rounded-none border-0 pr-1.5 pl-2 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {pageSizeOptions.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-sm text-gray-900">
          Showing {showingStart} to {showingEnd} of {totalItems} results
        </p>
      </div>

      <Pagination className="ml-auto w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink
              href="#"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                table.firstPage();
              }}
              className={cn(
                "h-9 w-9",
                !table.getCanPreviousPage() && "pointer-events-none opacity-50"
              )}
            >
              <ChevronsLeft className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>

          <PaginationItem>
            <PaginationLink
              href="#"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                table.previousPage();
              }}
              className={cn(
                "h-9 w-9",
                !table.getCanPreviousPage() && "pointer-events-none opacity-50"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>

          {pageNumbers.map((pageNum) => (
            <PaginationItem key={pageNum}>
              <PaginationLink
                href="#"
                isActive={currentPage === pageNum}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  table.setPageIndex(pageNum - 1);
                }}
                className={cn(
                  "h-9 w-9",
                  currentPage === pageNum &&
                    "bg-[#293C79] text-white hover:bg-[#293C79]/90"
                )}
              >
                {pageNum}
              </PaginationLink>
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationLink
              href="#"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                table.nextPage();
              }}
              className={cn(
                "h-9 w-9",
                !table.getCanNextPage() && "pointer-events-none opacity-50"
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>

          <PaginationItem>
            <PaginationLink
              href="#"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                table.lastPage();
              }}
              className={cn(
                "h-9 w-9",
                !table.getCanNextPage() && "pointer-events-none opacity-50"
              )}
            >
              <ChevronsRight className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
