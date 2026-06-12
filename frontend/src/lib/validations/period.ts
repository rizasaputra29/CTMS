import { z } from "zod"

// Schema for evaluation component from Assessment Bank
const evaluationComponentSchema = z.object({
  id: z.union([z.string(), z.number()]),
  template_id: z.number().optional(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  weight: z.number(),
  selected: z.boolean().optional(),
})

// Schema for peer review indicator from Assessment Bank
const peerReviewIndicatorSchema = z.object({
  id: z.union([z.string(), z.number()]),
  template_id: z.number().optional(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  weight: z.number(),
  selected: z.boolean().optional(),
})

// Schema for evaluation type configuration (Tipe Penilaian)
const evaluationTypeConfigSchema = z.object({
  components: z.array(evaluationComponentSchema),
  totalWeight: z.number(),
})

// Schema for peer review configuration
const peerReviewConfigSchema = z.object({
  indicators: z.array(peerReviewIndicatorSchema),
  enabled: z.boolean(),
  totalWeight: z.number(),
})

export const periodSchema = z.object({
  name: z.string().min(3, "Nama periode minimal 3 karakter").max(100, "Nama periode maksimal 100 karakter"),
  start_date: z.string().min(1, "Tanggal mulai wajib diisi"),
  end_date: z.string().min(1, "Tanggal berakhir wajib diisi"),
  is_active: z.boolean(),
  bidding_start: z.string().optional(),
  bidding_end: z.string().optional(),
  bidding_reminder_at: z.string().optional(),
  pdc1_start: z.string().optional(),
  pdc1_end: z.string().optional(),
  pdc1_reminder_at: z.string().optional(),
  pdc2_start: z.string().optional(),
  pdc2_end: z.string().optional(),
  pdc2_reminder_at: z.string().optional(),
  expo_date: z.string().optional(),
  expo_reminder_at: z.string().optional(),
  ta_start: z.string().optional(),
  ta_end: z.string().optional(),
  ta_reminder_at: z.string().optional(),
  min_group_size: z.number().min(1, "Minimal 1 anggota").max(10, "Maksimal 10 anggota"),
  max_group_size: z.number().min(1, "Minimal 1 anggota").max(10, "Maksimal 10 anggota"),
  max_supervisor_load: z.number().min(1, "Minimal 1 group").max(50, "Maksimal 50 group"),
  // Evaluation configurations for each phase - now integrated with Assessment Bank
  evaluation_configs: z.object({
    sidang_ta: evaluationTypeConfigSchema,
    expo: evaluationTypeConfigSchema,
    bimbingan_sempro: evaluationTypeConfigSchema,
    bimbingan_ta: evaluationTypeConfigSchema,
    nilai_dosen: evaluationTypeConfigSchema,
    milestone: evaluationTypeConfigSchema,
  }),
  // Peer review configuration - now uses Assessment Bank templates
  peer_review_config: peerReviewConfigSchema,
}).refine((data) => {
  if (data.start_date && data.end_date) {
    return new Date(data.start_date) <= new Date(data.end_date)
  }
  return true
}, {
  message: "Tanggal berakhir harus setelah tanggal mulai",
  path: ["end_date"],
}).refine((data) => {
  if (data.min_group_size && data.max_group_size) {
    return data.min_group_size <= data.max_group_size
  }
  return true
}, {
  message: "Minimal anggota harus lebih kecil atau sama dengan maksimal anggota",
  path: ["max_group_size"],
})

export type PeriodFormData = z.infer<typeof periodSchema>
export type EvaluationComponent = z.infer<typeof evaluationComponentSchema>
export type EvaluationTypeConfig = z.infer<typeof evaluationTypeConfigSchema>
export type PeerReviewIndicator = z.infer<typeof peerReviewIndicatorSchema>
export type PeerReviewConfig = z.infer<typeof peerReviewConfigSchema>

// Assessment Bank Template type
export interface AssessmentTemplate {
  id: number;
  code: string;
  name: string;
  description: string | null;
  weight: number;
  is_active: boolean | number | string;
  sort_order: number;
}

// API Response types for Assessment Bank integration
export interface AssessmentConfigResponse {
  period: {
    id: number;
    name: string;
  };
  type: string;
  all_templates: AssessmentTemplate[];
  selected_components: {
    id: number;
    template_id: number;
    code: string;
    name: string;
    description: string | null;
    weight: number;
    sort_order: number;
  }[];
}

export interface PeerReviewConfigResponse {
  period: {
    id: number;
    name: string;
  };
  all_templates: AssessmentTemplate[];
  selected_indicators: {
    id: number;
    template_id: number;
    code: string;
    name: string;
    description: string | null;
    weight: number;
    sort_order: number;
  }[];
}
