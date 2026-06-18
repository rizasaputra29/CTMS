"use client";

import { Badge } from "@/components/ui/badge";
import { DataTableColumn } from "@/components/ui/data-table";
import { getEvaluationData } from "@/types/guards";
import type { StudentEvaluation } from "../types";

const EVALUATION_TYPES = [
  { key: "SEMPRO", label: "SEMPRO" },
  { key: "BIMBINGAN_SEMPRO", label: "BIMBINGAN" },
  { key: "SIDANG_TA", label: "SIDANG TA" },
  { key: "BIMBINGAN_TA", label: "BIMBINGAN TA" },
  { key: "EXPO", label: "EXPO" },
  { key: "MILESTONE", label: "MILESTONE" },
  { key: "NILAI_DOSEN", label: "NILAI DOSEN" },
] as const;

const getScoreColor = (score: number | null): string => {
  if (score === null) return "text-gray-400";
  if (score >= 85) return "text-emerald-600";
  if (score >= 70) return "text-blue-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "COMPLETE":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs">
          Complete
        </Badge>
      );
    case "PARTIAL":
      return (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-xs">
          Partial
        </Badge>
      );
    case "NOT_STARTED":
    default:
      return (
        <Badge variant="secondary" className="text-xs">
          Not Started
        </Badge>
      );
  }
};

export function useAssessmentColumns(): DataTableColumn<StudentEvaluation>[] {
  const columns: DataTableColumn<StudentEvaluation>[] = [
    {
      key: "student_name",
      header: "Student",
      sortable: true,
      render: (student) => (
        <div>
          <div className="font-medium text-sm">{student.student_name}</div>
          <div className="text-xs text-muted-foreground">
            {student.student_nim}
          </div>
        </div>
      ),
    },
    {
      key: "group_name",
      header: "Group",
      sortable: true,
      render: (student) => (
        <span className="text-sm text-muted-foreground">
          {student.group_name}
        </span>
      ),
    },
  ];

  EVALUATION_TYPES.forEach((type) => {
    columns.push({
      key: type.key,
      header: type.label,
      align: "center",
      render: (student) => {
        const evalData = getEvaluationData(student.evaluations, type.key);
        return (
          <div className="text-center">
            <div
              className={`text-lg font-bold ${getScoreColor(
                evalData?.score ?? null
              )}`}
            >
              {evalData?.score != null ? Math.round(evalData.score) : "–"}
            </div>
            <div className="mt-1">{getStatusBadge(evalData?.status ?? "")}</div>
          </div>
        );
      },
    });
  });

  return columns;
}
