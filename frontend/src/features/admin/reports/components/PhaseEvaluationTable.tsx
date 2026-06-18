"use client";

import { DataTable } from "@/components/ui/data-table";
import { GraduationCap, Filter } from "lucide-react";
import { usePhaseEvaluationColumns } from "./PhaseEvaluationColumns";
import type { PhaseStudentEvaluation, PaginationData, ReportPhase } from "../types";

interface PhaseEvaluationTableProps {
  phase: ReportPhase;
  students: PhaseStudentEvaluation[];
  loading: boolean;
  pagination: PaginationData;
  search: string;
  onSearchChange: (value: string) => void;
  sortBy: "group" | "name";
  onSortByChange: (value: "group" | "name") => void;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
  periodId?: string;
}

export function PhaseEvaluationTable({
  phase,
  students,
  loading,
  pagination,
  search,
  onSearchChange,
  sortBy,
  onSortByChange,
  onPageChange,
  onPerPageChange,
  periodId = "",
}: PhaseEvaluationTableProps) {
  const columns = usePhaseEvaluationColumns(phase, students, periodId);

  return (
    <DataTable<PhaseStudentEvaluation>
      title="Assessment Scores"
      data={students}
      columns={columns}
      loading={loading}
      emptyMessage="No students found"
      emptySubMessage="No students match your search criteria."
      emptyIcon={<GraduationCap className="h-10 w-10" />}
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search name or NIM..."
      sortKey={sortBy}
      sortDir="asc"
      onSort={(key) => onSortByChange(key as "group" | "name")}
      filterSlot={
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>Sort by {sortBy === "group" ? "Group" : "Student Name"}</span>
        </div>
      }
      pagination={pagination}
      onPageChange={onPageChange}
      onPerPageChange={onPerPageChange}
      rowIdKey="student_id"
    />
  );
}
