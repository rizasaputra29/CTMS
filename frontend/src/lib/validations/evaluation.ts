import { z } from "zod"

export const evaluationScoreSchema = z.object({
  scores: z.record(z.string(), z.number().min(0, "Score must be at least 0").max(100, "Score must be at most 100")),
  notes: z.string().max(500, "Notes must be at most 500 characters").optional(),
})

export type EvaluationScoreFormData = z.infer<typeof evaluationScoreSchema>
