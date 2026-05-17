import { z } from "zod"

export const titleSchema = z.object({
  title: z.string()
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title must be at most 200 characters"),
  description: z.string()
    .min(20, "Description must be at least 20 characters")
    .max(1000, "Description must be at most 1000 characters"),
  problem_statement: z.string()
    .min(10, "Problem statement must be at least 10 characters")
    .max(500, "Problem statement must be at most 500 characters"),
  scope: z.string()
    .min(10, "Scope must be at least 10 characters")
    .max(500, "Scope must be at most 500 characters"),
  specializations: z.array(z.string()).optional(),
  quota: z.number()
    .min(1, "Quota must be at least 1")
    .max(10, "Quota must be at most 10"),
  pre_assigned_group_id: z.string().optional(),
})

export type TitleFormData = z.infer<typeof titleSchema>
