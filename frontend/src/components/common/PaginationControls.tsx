"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PaginationControlsProps {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  showingStart: number;
  showingEnd: number;
  pageSizes?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
  showPageSizeSelector?: boolean;
  size?: "sm" | "default";
}

export function PaginationControls({
  page,
  pageSize,
  totalPages,
  totalItems,
  showingStart,
  showingEnd,
  pageSizes = [10, 25, 50],
  onPageChange,
  onPageSizeChange,
  className,
  showPageSizeSelector = true,
  size = "default",
}: PaginationControlsProps) {
  const buttonSize = size === "sm" ? "sm" : "default";
  const selectTriggerClass =
    size === "sm" ? "h-7 w-15 text-[12px]" : "h-9 w-[70px]";

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground">
          Showing {showingStart}–{showingEnd} of {totalItems}
        </p>
        {showPageSizeSelector && (
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] text-muted-foreground/60">Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange(Number(v))}
            >
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizes.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size={buttonSize}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground px-2">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size={buttonSize}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
