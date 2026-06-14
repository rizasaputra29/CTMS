"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
  type ExpandedState,
} from "@tanstack/react-table";
import { CalendarDays, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/DataTable";
import { DataTableToolbar } from "@/components/common/DataTableToolbar";
import { DataTableFilterPopover } from "@/components/common/DataTableFilterPopover";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import {
  periodColumns,
  PeriodExpandedContent,
} from "@/features/admin/periods/components/PeriodTableColumns";
import type { Period } from "@/features/admin/periods/types";

interface PeriodTableProps {
  periods: Period[];
  loading: boolean;
  onEdit: (period: Period) => void;
  onDelete: (period: Period) => void;
  onToggleActive: (period: Period) => void;
  deleting: number | null;
}

export function PeriodTable({
  periods,
  loading,
  onEdit,
  onDelete,
  onToggleActive,
  deleting,
}: PeriodTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const columns = useMemo(
    () => periodColumns({ onEdit, onDelete, onToggleActive, deleting }),
    [onEdit, onDelete, onToggleActive, deleting]
  );

  const table = useReactTable({
    data: periods,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    state: { sorting, columnFilters, globalFilter, pagination, expanded },
  });

  const statusFilterValue =
    (table.getColumn("is_active")?.getFilterValue() as string) ?? "all";
  const hasFilters = columnFilters.length > 0;

  return (
    <div className="rounded-xl border">
      <DataTableToolbar
        title="Period Table"
        searchPlaceholder="Cari periode..."
        searchValue={globalFilter}
        onSearchChange={setGlobalFilter}
      >
        <DataTableFilterPopover
          label="Status"
          icon={CalendarDays}
          options={[
            { value: "all", label: "Semua Status" },
            { value: "true", label: "Aktif" },
            { value: "false", label: "Nonaktif" },
          ]}
          value={statusFilterValue}
          onChange={(value) =>
            table
              .getColumn("is_active")
              ?.setFilterValue(value === "all" ? undefined : value === "true")
          }
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 cursor-pointer gap-1.5 text-gray-500"
            onClick={() => {
              table.resetColumnFilters();
              setGlobalFilter("");
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </DataTableToolbar>

      <DataTable
        table={table}
        loading={loading}
        emptyIcon={<CalendarDays className="h-8 w-8 text-gray-400" />}
        emptyTitle="Tidak ada periode ditemukan"
        emptyDescription="Coba ubah filter atau buat periode baru"
        renderExpandedRow={(period) => (
          <PeriodExpandedContent period={period} />
        )}
      />

      {!loading && table.getFilteredRowModel().rows.length > 0 && (
        <DataTablePagination table={table} />
      )}
    </div>
  );
}
