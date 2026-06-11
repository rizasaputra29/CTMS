import { z } from "zod"

export const supervisorAssignmentSchema = z.object({
  supervisor_1_id: z.number().optional(),
  supervisor_2_id: z.number().optional(),
  notes: z.string().max(1000, "Notes must be at most 1000 characters").optional(),
}).refine((data) => {
  if (data.supervisor_2_id !== undefined && data.supervisor_2_id !== null && data.supervisor_1_id !== undefined) {
    return data.supervisor_1_id !== data.supervisor_2_id;
  }
  return true;
}, {
  message: "Supervisor 1 and Supervisor 2 cannot be the same",
  path: ["supervisor_2_id"],
})

export type SupervisorAssignmentFormData = z.infer<typeof supervisorAssignmentSchema>
