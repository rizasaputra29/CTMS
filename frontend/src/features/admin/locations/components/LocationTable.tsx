"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
} from "@tanstack/react-table";
import { Filter, MapPin, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/DataTable";
import { DataTableToolbar } from "@/components/common/DataTableToolbar";
import { DataTableFilterPopover } from "@/components/common/DataTableFilterPopover";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { locationColumns } from "@/features/admin/locations/components/LocationTableColumns";
import type { Location } from "@/features/admin/locations/types";

interface LocationTableProps {
  locations: Location[];
  loading: boolean;
  onEdit: (location: Location) => void;
  onDelete: (location: Location) => void;
  deleting: number | null;
}

export function LocationTable({
  locations,
  loading,
  onEdit,
  onDelete,
  deleting,
}: LocationTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const columns = useMemo(
    () => locationColumns({ onEdit, onDelete, deleting }),
    [onEdit, onDelete, deleting]
  );

  const table = useReactTable({
    data: locations,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { sorting, columnFilters, globalFilter, pagination },
  });

  const typeFilterValue =
    (table.getColumn("type")?.getFilterValue() as string) ?? "all";
  const statusFilterValue =
    (table.getColumn("is_active")?.getFilterValue() as string) ?? "all";
  const hasFilters = columnFilters.length > 0;

  return (
    <div className="rounded-xl border">
      <DataTableToolbar
        title="Location Table"
        searchPlaceholder="Cari lokasi..."
        searchValue={globalFilter}
        onSearchChange={setGlobalFilter}
      >
        <DataTableFilterPopover
          label="Tipe"
          icon={Filter}
          options={[
            { value: "all", label: "Semua Tipe" },
            { value: "offline", label: "Offline" },
            { value: "online", label: "Online" },
          ]}
          value={typeFilterValue}
          onChange={(value) =>
            table
              .getColumn("type")
              ?.setFilterValue(value === "all" ? undefined : value)
          }
        />
        <DataTableFilterPopover
          label="Status"
          icon={Filter}
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
        emptyIcon={<MapPin className="h-8 w-8 text-gray-400" />}
        emptyTitle="Tidak ada lokasi ditemukan"
        emptyDescription="Coba ubah filter atau buat lokasi baru"
      />

      {!loading && table.getFilteredRowModel().rows.length > 0 && (
        <DataTablePagination table={table} />
      )}
    </div>
  );
}
