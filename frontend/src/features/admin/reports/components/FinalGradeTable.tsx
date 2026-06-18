"use client";

import { DataTable } from "@/components/ui/data-table";
import { Award } from "lucide-react";
import { useFinalGradeColumns } from "./FinalGradeColumns";
import type { FinalGrade, PaginationData } from "../types";

interface FinalGradeTableProps {
  grades: FinalGrade[];
  loading: boolean;
  pagination: PaginationData;
  search: string;
  onSearchChange: (value: string) => void;
  sortKey: "group" | "name";
  sortDir: "asc" | "desc";
  onSort: (key: "group" | "name") => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

export function FinalGradeTable({
  grades,
  loading,
  pagination,
  search,
  onSearchChange,
  sortKey,
  sortDir,
  onSort,
  onPageChange,
  onPerPageChange,
}: FinalGradeTableProps) {
  const columns = useFinalGradeColumns();

  return (
    <DataTable<FinalGrade>
      title="Final Grades"
      data={grades}
      columns={columns}
      loading={loading}
      emptyMessage="No data found"
      emptySubMessage="No grades match your filters."
      emptyIcon={<Award className="h-10 w-10" />}
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search name or NIM..."
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={(key) => onSort(key as "group" | "name")}
      pagination={pagination}
      onPageChange={onPageChange}
      onPerPageChange={onPerPageChange}
    />
  );
}
