"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type SortingState,
  type ColumnFiltersState,
  type PaginationState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { Filter, RotateCcw, Archive, ArchiveRestore, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/DataTable";
import { DataTableToolbar } from "@/components/common/DataTableToolbar";
import { DataTableFilterPopover } from "@/components/common/DataTableFilterPopover";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { assessmentBankColumns } from "@/features/admin/assessment-bank/components/AssessmentBankTableColumns";
import type { AssessmentTemplate } from "@/features/admin/assessment-bank/types";

interface AssessmentBankTableProps {
  templates: AssessmentTemplate[];
  loading: boolean;
  onEdit: (template: AssessmentTemplate) => void;
  onDelete: (template: AssessmentTemplate) => void;
  onToggleActive: (template: AssessmentTemplate) => void;
  onBulkActivate: (ids: number[]) => void;
  onBulkDeactivate: (ids: number[]) => void;
  onBulkDelete: (ids: number[]) => void;
  deleting: number | null;
}

export function AssessmentBankTable({
  templates,
  loading,
  onEdit,
  onDelete,
  onToggleActive,
  onBulkActivate,
  onBulkDeactivate,
  onBulkDelete,
  deleting,
}: AssessmentBankTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const columns = useMemo(
    () =>
      assessmentBankColumns({
        onEdit,
        onDelete,
        onToggleActive,
        deleting,
      }),
    [onEdit, onDelete, onToggleActive, deleting]
  );

  const table = useReactTable({
    data: templates,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
      rowSelection,
    },
    enableRowSelection: true,
  });

  const statusFilterValue =
    (table.getColumn("is_active")?.getFilterValue() as string) ?? "all";
  const hasFilters = columnFilters.length > 0 || globalFilter.length > 0;

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedIds = useMemo(
    () => selectedRows.map((row) => row.original.id),
    [selectedRows]
  );

  // Clear selection when filters or search change to match original behavior.
  useEffect(() => {
    table.resetRowSelection();
  }, [globalFilter, columnFilters, table]);

  const handleBulkActivate = () => {
    onBulkActivate(selectedIds);
    table.resetRowSelection();
  };

  const handleBulkDeactivate = () => {
    onBulkDeactivate(selectedIds);
    table.resetRowSelection();
  };

  const handleBulkDelete = () => {
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus ${selectedIds.length} komponen?`
      )
    ) {
      return;
    }
    onBulkDelete(selectedIds);
    table.resetRowSelection();
  };

  const handleResetFilters = () => {
    table.resetColumnFilters();
    setGlobalFilter("");
    table.resetRowSelection();
  };

  return (
    <div className="rounded-xl border">
      <DataTableToolbar
        title="Tabel Komponen"
        searchPlaceholder="Cari komponen..."
        searchValue={globalFilter}
        onSearchChange={setGlobalFilter}
      >
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
              ?.setFilterValue(
                value === "all" ? undefined : value === "true"
              )
          }
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 cursor-pointer gap-1.5 text-gray-500"
            onClick={handleResetFilters}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </DataTableToolbar>

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between border-b bg-indigo-50 px-6 py-3">
          <span className="text-sm font-medium text-indigo-900">
            {selectedIds.length} terpilih
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkActivate}
              className="h-8"
            >
              <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
              Aktifkan
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDeactivate}
              className="h-8"
            >
              <Archive className="mr-1.5 h-3.5 w-3.5" />
              Nonaktifkan
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              className="h-8"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Hapus
            </Button>
          </div>
        </div>
      )}

      <DataTable
        table={table}
        loading={loading}
        emptyIcon={<Search className="h-8 w-8 text-gray-400" />}
        emptyTitle="Tidak ada komponen ditemukan"
        emptyDescription="Coba ubah filter atau buat komponen pertama untuk memulai"
      />

      {!loading && table.getFilteredRowModel().rows.length > 0 && (
        <DataTablePagination table={table} />
      )}
    </div>
  );
}
