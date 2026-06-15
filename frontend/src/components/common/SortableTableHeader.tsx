"use client";

import { ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface SortableTableHeaderProps<TSortKey extends string = string> {
  label: string;
  sortKey: TSortKey;
  currentSortKey?: TSortKey;
  currentSortDir?: "asc" | "desc";
  onSort: (key: TSortKey) => void;
  className?: string;
}

export function SortableTableHeader<TSortKey extends string = string>({
  label,
  sortKey,
  currentSortKey,
  onSort,
  className,
}: SortableTableHeaderProps<TSortKey>) {
  const active = currentSortKey === sortKey;

  return (
    <TableHead
      className={cn(
        "cursor-pointer select-none hover:bg-muted/50",
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={cn(
            "h-3 w-3 transition-opacity",
            active ? "opacity-100" : "opacity-30"
          )}
        />
      </div>
    </TableHead>
  );
}
