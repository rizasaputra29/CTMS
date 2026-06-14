"use client";

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

const DEFAULT_PAGE_SIZES = [10, 25, 50];

export interface PaginationCustomProps {
  page: number;
  pageSize: number;
  totalItems: number;
  pageSizes?: number[];
  visiblePages?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
}

export function PaginationCustom({
  page,
  pageSize,
  totalItems,
  pageSizes = DEFAULT_PAGE_SIZES,
  visiblePages = 3,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationCustomProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  const showingStart = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingEnd = Math.min(safePage * pageSize, totalItems);

  // Calculate visible page numbers range (centered around current page)
  const halfVisible = Math.floor(visiblePages / 2);
  let startPage = Math.max(1, safePage - halfVisible);
  const endPage = Math.min(totalPages, startPage + visiblePages - 1);

  // Adjust start if we're near the end
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
        {/* Per page selector */}
        <div className="flex h-9 items-center overflow-hidden rounded-lg border">
          <span className="text-grey-900 bg-white px-2 text-sm tracking-tight">
            Per page
          </span>
          <div className="h-full border-l">
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className="text-grey-900 h-full gap-1.5 rounded-none border-0 pr-1.5 pl-2 font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {pageSizes.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results text */}
        <p className="text-sm text-gray-900">
          Showing {showingStart} to {showingEnd} of {totalItems} results
        </p>
      </div>

      {/* Pagination controls */}
      <Pagination className="ml-auto w-auto">
        <PaginationContent>
          {/* First page << */}
          <PaginationItem>
            <PaginationLink
              href="#"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                onPageChange(1);
              }}
              className={cn(
                "h-9 w-9",
                safePage === 1 && "pointer-events-none opacity-50"
              )}
            >
              <ChevronsLeft className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>

          {/* Previous < */}
          <PaginationItem>
            <PaginationLink
              href="#"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                onPageChange(Math.max(1, safePage - 1));
              }}
              className={cn(
                "h-9 w-9",
                safePage === 1 && "pointer-events-none opacity-50"
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>

          {/* Page numbers */}
          {pageNumbers.map((pageNum) => (
            <PaginationItem key={pageNum}>
              <PaginationLink
                href="#"
                isActive={safePage === pageNum}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  onPageChange(pageNum);
                }}
                className={cn(
                  "h-9 w-9",
                  safePage === pageNum &&
                    "bg-[#293C79] text-white hover:bg-[#293C79]/90"
                )}
              >
                {pageNum}
              </PaginationLink>
            </PaginationItem>
          ))}

          {/* Next > */}
          <PaginationItem>
            <PaginationLink
              href="#"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                onPageChange(Math.min(totalPages, safePage + 1));
              }}
              className={cn(
                "h-9 w-9",
                safePage === totalPages && "pointer-events-none opacity-50"
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </PaginationLink>
          </PaginationItem>

          {/* Last page >> */}
          <PaginationItem>
            <PaginationLink
              href="#"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                onPageChange(totalPages);
              }}
              className={cn(
                "h-9 w-9",
                safePage === totalPages && "pointer-events-none opacity-50"
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
