import { z } from "zod"

export const createBidSchema = z.object({
  title_id: z.string().min(1, "Please select a title"),
  proposed_supervisor_1_id: z.string().min(1, "Please select first supervisor"),
  proposed_supervisor_2_id: z.string().min(1, "Please select second supervisor"),
})

export type CreateBidFormData = z.infer<typeof createBidSchema>
