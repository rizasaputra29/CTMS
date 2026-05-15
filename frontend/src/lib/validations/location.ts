import { z } from "zod"

export const locationSchema = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  type: z.enum(["offline", "online"]),
  capacity: z.string().optional(),
  description: z.string().max(500, "Description must be at most 500 characters").optional(),
  is_active: z.boolean(),
})

export type LocationFormData = z.infer<typeof locationSchema>
