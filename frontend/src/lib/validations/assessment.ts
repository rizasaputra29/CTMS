import { z } from "zod"

// Template for assessment bank (code, name, weight, is_active)
export const assessmentBankTemplateSchema = z.object({
  code: z.string().min(1, "Code is required").max(50, "Code must be at most 50 characters"),
  name: z.string().min(1, "Name is required").max(255, "Name must be at most 255 characters"),
  description: z.string().max(500, "Description must be at most 500 characters").optional(),
  weight: z.number().min(0, "Weight must be at least 0").max(100, "Weight must be at most 100"),
  is_active: z.boolean(),
})

// Template for assessment with criteria
export const assessmentTemplateSchema = z.object({
  name: z.string().min(3, "Template name must be at least 3 characters").max(100, "Template name must be at most 100 characters"),
  description: z.string().max(500, "Description must be at most 500 characters").optional(),
  criteria: z.array(z.object({
    name: z.string().min(1, "Criterion name is required"),
    weight: z.number().min(0).max(100, "Weight must be between 0 and 100"),
    max_score: z.number().min(1, "Max score must be at least 1").max(100, "Max score must be at most 100"),
  })).min(1, "Please add at least one criterion"),
})

export type AssessmentBankTemplateFormData = z.infer<typeof assessmentBankTemplateSchema>
export type AssessmentTemplateFormData = z.infer<typeof assessmentTemplateSchema>
