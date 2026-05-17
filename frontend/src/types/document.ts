/**
 * Document Type Definitions
 * Documents, requirements, and workflow types
 */

import type { User } from './user';

/**
 * Document status types
 */
export type DocumentStatus =
  | 'missing'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVISION';

/**
 * Document type categories
 */
export type DocumentType =
  | 'PROPOSAL'
  | 'TA_DRAFT'
  | 'TA_FINAL'
  | 'SEMPRO_SLIDES'
  | 'EXPO_POSTER'
  | 'PDC1_REPORT'
  | 'PDC2_REPORT'
  | 'BIMBINGAN_LOG'
  | 'PEER_REVIEW'
  | string;

/**
 * Main Document interface
 */
export interface Document {
  id: number;
  group_id?: number;
  student_id?: number;
  type: DocumentType;
  status: DocumentStatus;
  file_path?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by?: number;
  uploader?: User;
  notes?: string;
  rejection_reason?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

/**
 * Document phase configuration
 * Used in document requirements
 */
export interface DocumentPhase {
  phase: string;
  configured: boolean;
  count: number;
  required_count: number;
  documents: Document[];
}

/**
 * Document requirements status
 */
export interface DocumentRequirementsStatus {
  phases: Record<string, {
    configured: boolean;
    count: number;
    required_count: number;
  }>;
  all_configured: boolean;
  configured_phases: number;
  total_phases: number;
  total_requirements: number;
}

/**
 * Document upload request
 */
export interface DocumentUploadRequest {
  type: DocumentType;
  file: File;
  notes?: string;
}

/**
 * Document approval request
 */
export interface DocumentApprovalRequest {
  status: DocumentStatus;
  rejection_reason?: string;
}

/**
 * Document type configuration
 * Used in admin document configuration
 */
export interface DocumentTypeConfig {
  id: number;
  name: string;
  code: DocumentType;
  description?: string;
  required: boolean;
  phase: string;
  file_types?: string[];
  max_file_size?: number;
  is_active: boolean;
}

/**
 * Latest document info
 * Used in workflow phases
 */
export interface LatestDocument {
  id: number;
  status: DocumentStatus;
  file_url?: string;
  file_name?: string;
  version: number;
  updated_at: string;
  rejection_reason?: string;
}

/**
 * Phase document requirement
 */
export interface PhaseDocumentRequirement {
  type: DocumentType;
  name: string;
  required: boolean;
  status: DocumentStatus;
  latest_document?: LatestDocument | null;
}
