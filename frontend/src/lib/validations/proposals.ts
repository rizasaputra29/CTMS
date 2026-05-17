import { z } from "zod"

export const proposeTitleSchema = z.object({
  title: z.string()
    .min(5, "Title must be at least 5 characters")
    .max(100, "Title must be at most 100 characters"),
  description: z.string()
    .min(20, "Description must be at least 20 characters")
    .max(500, "Description must be at most 500 characters"),
  problem_statement: z.string()
    .min(10, "Problem statement must be at least 10 characters")
    .max(300, "Problem statement must be at most 300 characters"),
  scope: z.string()
    .min(10, "Scope must be at least 10 characters")
    .max(300, "Scope must be at most 300 characters"),
  specializations: z.array(z.string()).min(1, "Please select at least one specialization"),
  proposed_supervisor_id: z.string().min(1, "Please select a proposed supervisor"),
})

export type ProposeTitleFormData = z.infer<typeof proposeTitleSchema>
