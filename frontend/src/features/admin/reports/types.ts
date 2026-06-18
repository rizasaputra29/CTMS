import type { EvaluationStatusData } from "@/types/guards";

export type ReportPhase = "pdc1" | "pdc2" | "ta";

export interface Period {
  id: number;
  name: string;
  is_active: boolean;
}

export interface PaginationData {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface EvaluatorScore {
  evaluator_id: number | null;
  name: string;
  role: string;
  score: number | null;
}

export interface PhaseEvaluationItem {
  score: number | null;
  status: "COMPLETE" | "PARTIAL" | "NOT_STARTED";
  evaluators: EvaluatorScore[];
}

export interface PhaseStudentEvaluation {
  student_id: number;
  student_name: string;
  student_nim: string;
  group_id: number;
  group_name: string;
  evaluations: Record<string, PhaseEvaluationItem>;
  overall_status: "COMPLETE" | "PARTIAL" | "NOT_STARTED";
}

export interface ReportSummary {
  assessments: {
    total_scores: number;
    total_groups: number;
    total_students: number;
    average_score: number;
    pdc1_average: number | null;
    pdc2_average: number | null;
    ta_average: number | null;
    pdc1_students: number;
    pdc2_students: number;
    ta_students: number;
    top_groups: Array<{
      group_id: number;
      group_name: string;
      student_count: number;
      average_score: number;
    }>;
  };
  peer_reviews: {
    total_reviews: number;
    total_groups: number;
    average_score: number;
    pdc1_average: number | null;
    pdc2_average: number | null;
    ta_average: number | null;
    pdc1_reviews: number;
    pdc2_reviews: number;
    ta_reviews: number;
    top_groups: Array<{
      group_id: number;
      group_name: string;
      student_count: number;
      average_score: number;
    }>;
  };
  final_grades: {
    total_students: number;
    complete: number;
    incomplete: number;
    pdc1_complete: number;
    pdc2_complete: number;
    ta_complete: number;
    pdc1_average: number | null;
    pdc2_average: number | null;
    ta_average: number | null;
    top_students: Array<{
      group_id: number;
      group_name: string;
      student_id: number;
      student_name: string;
      student_nim: string;
      pdc1_score: number | null;
      pdc2_score: number | null;
      ta_score: number | null;
      pdc1_complete: boolean;
      pdc2_complete: boolean;
      ta_complete: boolean;
    }>;
  };
  groups: {
    total_groups: number;
    groups: Array<{
      group_id: number;
      group_name: string;
      status: string;
      member_count: number;
      supervisor_1: string;
      supervisor_2: string;
    }>;
  };
}

export interface StudentEvaluation {
  student_id: number;
  student_name: string;
  student_nim: string;
  group_id: number;
  group_name: string;
  evaluations: {
    SEMPRO: EvaluationStatusData;
    BIMBINGAN_SEMPRO: EvaluationStatusData;
    SIDANG_TA: EvaluationStatusData;
    BIMBINGAN_TA: EvaluationStatusData;
    EXPO: EvaluationStatusData;
    MILESTONE: EvaluationStatusData;
    NILAI_DOSEN: EvaluationStatusData;
  };
}

export interface FinalGrade {
  student_id: number;
  student_name: string;
  student_nim: string;
  group_id: number;
  group_title: string;
  pdc1_score: number | null;
  pdc2_score: number | null;
  ta_score: number | null;
  pdc1_complete: boolean;
  pdc2_complete: boolean;
  ta_complete: boolean;
  is_flagged?: boolean;
}

export interface PeerReview {
  id: number;
  raw_score: number;
  score: number;
  comment: string | null;
  created_at: string;
  reviewer: {
    id: number;
    name: string;
  };
  reviewee: {
    id: number;
    name: string;
  };
  group: {
    id: number;
    code?: string;
    title: {
      title: string;
    };
  };
  periodIndicator: {
    template: {
      code: string;
      name: string;
      weight: number;
    };
  };
}

export interface GroupMember {
  id: number;
  is_leader: boolean;
  student: {
    id: number;
    name: string;
    nim: string;
    email: string;
  };
}

export interface ReportGroup {
  id: number;
  code?: string;
  status: string;
  group_mode: string;
  created_at: string;
  title: {
    id: number;
    title: string;
    description: string | null;
  };
  supervisor1: {
    id: number;
    name: string;
    email: string;
  } | null;
  supervisor2: {
    id: number;
    name: string;
    email: string;
  } | null;
  members: GroupMember[];
  members_count: number;
}

export type AssessmentSortKey = "group" | "name";
export type FinalGradeSortKey = "group" | "name";
export type PeerReviewSortKey = "created_at" | "reviewer";
export type GroupSortKey = "code" | "status" | "members_count";

export type SortDir = "asc" | "desc";

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationData;
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}
