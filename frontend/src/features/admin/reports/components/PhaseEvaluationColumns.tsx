"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTableColumn } from "@/components/ui/data-table";
import type {
  ReportPhase,
  PhaseStudentEvaluation,
  EvaluatorScore,
  PhaseEvaluationItem,
} from "../types";

const ROLE_LABELS: Record<string, string> = {
  SUPERVISOR_1: "Pembimbing 1",
  SUPERVISOR_2: "Pembimbing 2",
  EXAMINER_1: "Penguji 1",
  EXAMINER_2: "Penguji 2",
};

const EVALUATION_LABELS: Record<string, string> = {
  SEMPRO: "Sempro",
  BIMBINGAN_SEMPRO: "Bimbingan Sempro",
  SIDANG_TA: "Sidang TA",
  BIMBINGAN_TA: "Bimbingan TA",
  EXPO: "Expo",
  MILESTONE: "Milestone",
  NILAI_DOSEN: "Nilai Dosen",
  PEER_REVIEW: "Peer Review",
};

const EVALUATION_ORDER: Record<ReportPhase, string[]> = {
  pdc1: ["SEMPRO", "BIMBINGAN_SEMPRO"],
  pdc2: ["NILAI_DOSEN", "MILESTONE", "EXPO", "PEER_REVIEW"],
  ta: ["SIDANG_TA", "BIMBINGAN_TA"],
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

function getRoleDisplayName(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

function getEvaluationLabel(type: string): string {
  return EVALUATION_LABELS[type] ?? type.replace(/_/g, " ");
}

function findEvaluator(evaluators: EvaluatorScore[], role: string): EvaluatorScore | undefined {
  return evaluators.find((e) => e.role === role);
}

function hasAnyEvaluatorForRole(
  students: PhaseStudentEvaluation[],
  type: string,
  role: string
): boolean {
  return students.some((student) => {
    const evalData = student.evaluations[type];
    return (evalData?.evaluators ?? []).some((e) => e.role === role);
  });
}

function scoreCell(score: number | null): React.ReactNode {
  if (score === null || score === undefined) {
    return <span className="text-muted-foreground">–</span>;
  }
  return <span className="text-sm font-medium tabular-nums">{Math.round(score)}</span>;
}

interface EvaluatorCellProps {
  evaluator: EvaluatorScore | undefined;
  studentId: number;
  evaluationType: string;
  periodId: string;
}

function EvaluatorCell({
  evaluator,
  studentId,
  evaluationType,
  periodId,
}: EvaluatorCellProps) {
  if (!evaluator?.evaluator_id) {
    return <span className="text-muted-foreground">–</span>;
  }

  const scoreContent = scoreCell(evaluator.score);
  const cellContent = (
    <div className="text-center space-y-0.5">
      <div className="inline-flex flex-col items-center">
        {scoreContent}
        {evaluator.name && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
            {evaluator.name}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <Link
      href={`/admin/reports/assessments/student/${studentId}/evaluation/${evaluationType}/evaluator/${evaluator.evaluator_id}?period_id=${periodId}`}
      className="block hover:bg-muted/50 rounded-md transition-colors"
    >
      {cellContent}
    </Link>
  );
}

function evaluationColumnsForPhase(
  phase: ReportPhase,
  students: PhaseStudentEvaluation[],
  periodId: string
): DataTableColumn<PhaseStudentEvaluation>[] {
  const types = EVALUATION_ORDER[phase];
  const columns: DataTableColumn<PhaseStudentEvaluation>[] = [];

  types.forEach((type) => {
    const evaluation = (student: PhaseStudentEvaluation): PhaseEvaluationItem | undefined =>
      student.evaluations[type];

    if (type === "PEER_REVIEW") {
      columns.push({
        key: `${phase}_peer_review`,
        header: "Peer Review",
        align: "center",
        render: (student) => {
          const evalData = evaluation(student);
          const scoreContent = (
            <div className="text-center space-y-1">
              <div className="text-sm font-medium tabular-nums">
                {evalData?.score != null ? Math.round(evalData.score) : "–"}
              </div>
              <div>{getStatusBadge(evalData?.status ?? "NOT_STARTED")}</div>
            </div>
          );
          
          return (
            <Link
              href={`/admin/reports/assessments/student/${student.student_id}/evaluation/PEER_REVIEW?period_id=${periodId}`}
              className="block hover:bg-muted/50 rounded-md transition-colors py-1"
            >
              {scoreContent}
            </Link>
          );
        },
      });
      return;
    }

    // EXPO: single combined score column with link to detail page
    if (type === "EXPO") {
      columns.push({
        key: `${phase}_${type}_score`,
        header: getEvaluationLabel(type),
        align: "center",
        render: (student) => {
          const evalData = evaluation(student);
          const scoreContent = (
            <div className="text-center space-y-1">
              <div className="text-sm font-medium tabular-nums">
                {evalData?.score != null ? Math.round(evalData.score) : "–"}
              </div>
              <div>{getStatusBadge(evalData?.status ?? "NOT_STARTED")}</div>
            </div>
          );
          
          return (
            <Link
              href={`/admin/reports/assessments/student/${student.student_id}/evaluation/EXPO?period_id=${periodId}`}
              className="block hover:bg-muted/50 rounded-md transition-colors py-1"
            >
              {scoreContent}
            </Link>
          );
        },
      });
      return;
    }

    // Grouped evaluation type with sub-columns for each evaluator role.
    // Determine active roles for this evaluation type across all students.
    const rolePriority =
      phase === "ta"
        ? ["EXAMINER_1", "EXAMINER_2", "SUPERVISOR_1", "SUPERVISOR_2"]
        : ["SUPERVISOR_1", "SUPERVISOR_2", "EXAMINER_1", "EXAMINER_2"];

    const activeRoles = rolePriority.filter((role) =>
      hasAnyEvaluatorForRole(students, type, role)
    );

    // Add grouped header column for evaluation type total
    columns.push({
      key: `${phase}_${type}_score`,
      header: (
        <div className="text-center">
          <div className="font-semibold text-xs uppercase tracking-wider">
            {getEvaluationLabel(type)}
          </div>
          <div className="text-[10px] text-muted-foreground font-normal">Total</div>
        </div>
      ),
      align: "center",
      render: (student) => {
        const evalData = evaluation(student);
        return (
          <div className="text-center space-y-1">
            <div className="text-sm font-medium tabular-nums">
              {evalData?.score != null ? Math.round(evalData.score) : "–"}
            </div>
            <div>{getStatusBadge(evalData?.status ?? "NOT_STARTED")}</div>
          </div>
        );
      },
    });

    // Add sub-columns for each active evaluator role
    activeRoles.forEach((role) => {
      columns.push({
        key: `${phase}_${type}_${role}`,
        header: (
          <div className="text-center text-[10px] leading-tight">
            <div className="text-muted-foreground font-normal">
              {getEvaluationLabel(type)}
            </div>
            <div className="font-semibold">{getRoleDisplayName(role)}</div>
          </div>
        ),
        align: "center",
        render: (student) => {
          const evalData = evaluation(student);
          const evaluator = findEvaluator(evalData?.evaluators ?? [], role);
          return (
            <EvaluatorCell
              evaluator={evaluator}
              studentId={student.student_id}
              evaluationType={type}
              periodId={periodId}
            />
          );
        },
      });
    });
  });

  return columns;
}

export function usePhaseEvaluationColumns(
  phase: ReportPhase,
  students: PhaseStudentEvaluation[],
  periodId: string
): DataTableColumn<PhaseStudentEvaluation>[] {
  const baseColumns: DataTableColumn<PhaseStudentEvaluation>[] = [
    {
      key: "student_name",
      header: "Student",
      sortable: true,
      render: (student) => (
        <div>
          <div className="font-medium text-sm">{student.student_name}</div>
          <div className="text-xs text-muted-foreground">{student.student_nim}</div>
        </div>
      ),
    },
    {
      key: "group_name",
      header: "Group",
      sortable: true,
      render: (student) => (
        <span className="text-sm text-muted-foreground">{student.group_name}</span>
      ),
    },
  ];

  return [...baseColumns, ...evaluationColumnsForPhase(phase, students, periodId)];
}
