import { z } from "zod"

// Schema for TA Defense schedule creation
export const taDefenseSchema = z.object({
  period_id: z.string().min(1, "Period is required"),
  group_id: z.string().min(1, "Please select a group"),
  student_ids: z.array(z.string()).min(1, "Please select at least one student"),
  date: z.string().min(1, "Date is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  location_id: z.string().min(1, "Location is required"),
  examiner_1_id: z.string().min(1, "Please select Examiner 1"),
  examiner_2_id: z.string().min(1, "Please select Examiner 2"),
  notes: z.string().max(500, "Notes must be at most 500 characters").optional(),
}).refine((data) => {
  if (data.start_time && data.end_time) {
    return data.start_time < data.end_time
  }
  return true
}, {
  message: "End time must be after start time",
  path: ["end_time"],
}).refine((data) => {
  return data.examiner_1_id !== data.examiner_2_id
}, {
  message: "Examiner 1 and Examiner 2 cannot be the same",
  path: ["examiner_2_id"],
})

export type TaDefenseFormData = z.infer<typeof taDefenseSchema>
