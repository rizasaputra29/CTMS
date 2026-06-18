"use client";

import { Badge } from "@/components/ui/badge";
import { DataTableColumn } from "@/components/ui/data-table";
import type { FinalGrade } from "../types";

const getScoreColor = (score: number | null): string => {
  if (score === null) return "text-gray-400";
  if (score >= 85) return "text-emerald-600";
  if (score >= 70) return "text-blue-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
};

export function useFinalGradeColumns(): DataTableColumn<FinalGrade>[] {
  return [
    {
      key: "group_title",
      header: "Group",
      sortable: true,
      render: (grade) => (
        <span className="font-medium text-sm">
          {grade.group_title || `Group ${grade.group_id}`}
        </span>
      ),
    },
    {
      key: "student_name",
      header: "Student",
      sortable: true,
      render: (grade) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{grade.student_name}</span>
          {grade.is_flagged && (
            <Badge variant="destructive" className="text-xs">
              Flagged
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "student_nim",
      header: "NIM",
      render: (grade) => (
        <span className="text-sm text-muted-foreground">
          {grade.student_nim}
        </span>
      ),
    },
    {
      key: "pdc1_score",
      header: "PDC 1",
      align: "right",
      sortable: true,
      render: (grade) => (
        <span
          className={`text-base font-bold ${getScoreColor(grade.pdc1_score)}`}
        >
          {grade.pdc1_score !== null && !Number.isNaN(grade.pdc1_score)
            ? Number(grade.pdc1_score).toFixed(1)
            : "N/A"}
        </span>
      ),
    },
    {
      key: "pdc1_complete",
      header: "PDC1 Status",
      align: "center",
      render: (grade) => (
        <Badge variant={grade.pdc1_complete ? "default" : "secondary"}>
          {grade.pdc1_complete ? "Complete" : "Incomplete"}
        </Badge>
      ),
    },
    {
      key: "pdc2_score",
      header: "PDC 2",
      align: "right",
      sortable: true,
      render: (grade) => (
        <span
          className={`text-base font-bold ${getScoreColor(grade.pdc2_score)}`}
        >
          {grade.pdc2_score !== null && !Number.isNaN(grade.pdc2_score)
            ? Number(grade.pdc2_score).toFixed(1)
            : "N/A"}
        </span>
      ),
    },
    {
      key: "pdc2_complete",
      header: "PDC2 Status",
      align: "center",
      render: (grade) => (
        <Badge variant={grade.pdc2_complete ? "default" : "secondary"}>
          {grade.pdc2_complete ? "Complete" : "Incomplete"}
        </Badge>
      ),
    },
    {
      key: "ta_score",
      header: "TA",
      align: "right",
      sortable: true,
      render: (grade) => (
        <span
          className={`text-base font-bold ${getScoreColor(grade.ta_score)}`}
        >
          {grade.ta_score !== null && !Number.isNaN(grade.ta_score)
            ? Number(grade.ta_score).toFixed(1)
            : "N/A"}
        </span>
      ),
    },
    {
      key: "ta_complete",
      header: "TA Status",
      align: "center",
      render: (grade) => (
        <Badge variant={grade.ta_complete ? "default" : "secondary"}>
          {grade.ta_complete ? "Complete" : "Incomplete"}
        </Badge>
      ),
    },
  ];
}
