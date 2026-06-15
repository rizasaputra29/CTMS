/**
 * Shared application constants.
 * Prefer importing from here over magic numbers/strings scattered through features.
 */

// ------------------------------------------------------------------
// Capstone workflow phases
// ------------------------------------------------------------------

export const PHASE_ORDER = [
  "PDC1",
  "SEMPRO",
  "PDC2",
  "TA_DRAFT",
  "EXPO",
  "TA",
] as const;

export type PhaseId = (typeof PHASE_ORDER)[number];

export const PHASE_LABELS: Record<PhaseId, string> = {
  PDC1: "PDC 1",
  SEMPRO: "Seminar Proposal",
  PDC2: "PDC 2",
  TA_DRAFT: "Draft TA",
  EXPO: "Expo",
  TA: "Tugas Akhir",
};

export const PHASE_DESCRIPTIONS: Record<PhaseId, string> = {
  PDC1: "Tahap perencanaan awal dan pembentukan kelompok.",
  SEMPRO: "Tahap seminar proposal untuk menyetujui topik.",
  PDC2: "Tahap pengembangan lanjutan proyek.",
  TA_DRAFT: "Tahap penulisan draf Tugas Akhir.",
  EXPO: "Tahap presentasi dan publikasi proyek.",
  TA: "Tahap akhir Tugas Akhir dan sidang.",
};

// ------------------------------------------------------------------
// Group / bidding constraints
// ------------------------------------------------------------------

export const MAX_TITLES = 3;
export const MIN_GROUP_SIZE = 3;
export const MAX_GROUP_SIZE = 4;

// ------------------------------------------------------------------
// File upload
// ------------------------------------------------------------------

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx", ".ppt", ".pptx"] as const;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

// ------------------------------------------------------------------
// Grade thresholds
// ------------------------------------------------------------------

export const GRADE_THRESHOLDS = {
  A: 85,
  B: 70,
  C: 60,
  D: 50,
} as const;

// ------------------------------------------------------------------
// Evaluation / assessment
// ------------------------------------------------------------------

export const EVALUATION_TYPES = [
  { id: "sidang_ta", label: "Sidang TA" },
  { id: "expo", label: "Expo" },
  { id: "bimbingan_sempro", label: "Bimbingan Sempro" },
  { id: "bimbingan_ta", label: "Bimbingan TA" },
  { id: "peer_review", label: "Peer Review" },
  { id: "milestone", label: "Milestone" },
  { id: "nilai_dosen", label: "Nilai Dosen" },
] as const;

// ------------------------------------------------------------------
// Audit log action types
// ------------------------------------------------------------------

export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "REJECT",
  "ASSIGN",
  "SUBMIT",
  "UPLOAD",
  "LOGIN",
  "LOGOUT",
  "EXPORT",
  "IMPORT",
  "FLAG",
  "UNFLAG",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
