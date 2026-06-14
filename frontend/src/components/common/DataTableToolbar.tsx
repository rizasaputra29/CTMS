"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface DataTableToolbarProps {
  title?: string;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  children?: React.ReactNode;
}

export function DataTableToolbar({
  title,
  searchPlaceholder = "Cari...",
  searchValue,
  onSearchChange,
  children,
}: DataTableToolbarProps) {
  return (
    <div className="border-b px-6 py-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        {title && (
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          </div>
        )}
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:justify-end">
          <div className="relative w-full sm:w-72">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
