// Document Upload Types

export interface Student {
  id: number;
  name: string;
  nim: string | null;
  email: string;
}

export interface GroupMember {
  id: number;
  name: string;
  nim: string | null;
  email: string;
  is_leader: boolean;
}

export interface Group {
  id: number;
  code: string;
}

export interface Period {
  id: number;
  name: string;
}

export interface Reviewer {
  id: number;
  name: string;
}

export interface ExpoEvent {
  id: number;
  name: string;
}

export type DocumentSource = "phase_documents" | "expo_documents" | "ta_documents";

export interface DocumentUpload {
  id: number;
  source: DocumentSource;
  source_label: string;
  file_path: string;
  original_name: string;
  document_type: string;
  phase: string;
  status: string;
  feedback: string | null;
  uploaded_at: string;
  student: Student | null;
  group: Group | null;
  period: Period | null;
  reviewer: Reviewer | null;
  expo_event?: ExpoEvent | null;
}

export interface GroupDocumentUpload {
  group_id: number;
  group_code: string;
  period: Period | null;
  members: GroupMember[];
  total_documents: number;
  phase_documents_count: number;
  expo_documents_count: number;
  ta_documents_count: number;
  latest_upload_at: string;
  documents: DocumentUpload[];
}

export interface DocumentSummary {
  groups_with_uploads: number;
  students_with_uploads: number;
  phase_documents: number;
  expo_documents: number;
  ta_documents: number;
  total_documents: number;
}

export interface PeriodOption {
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

export type SortKey = "group_code" | "period" | "total_documents" | "latest_upload_at";
export type SortDir = "asc" | "desc";

export interface DocumentFilters {
  period_id?: string;
  group_id?: string;
  student_id?: string;
  source?: DocumentSource | "all";
  status?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}
