import { z } from "zod"

// Schema for SEMPRO schedule form
export const semproScheduleSchema = z.object({
  period_id: z.string().min(1, "Period is required"),
  group_id: z.string().min(1, "Group is required"),
  date: z.string().min(1, "Date is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  location_id: z.string().min(1, "Location is required"),
  examiner_1_id: z.string().min(1, "Examiner 1 is required"),
  examiner_2_id: z.string().min(1, "Examiner 2 is required"),
}).refine((data) => {
  if (data.start_time && data.end_time) {
    return data.start_time < data.end_time
  }
  return true
}, {
  message: "End time must be after start time",
  path: ["end_time"],
}).refine((data) => {
  if (data.examiner_1_id && data.examiner_2_id) {
    return data.examiner_1_id !== data.examiner_2_id
  }
  return true
}, {
  message: "Examiner 1 and Examiner 2 cannot be the same person",
  path: ["examiner_2_id"],
})

export type SemproScheduleFormData = z.infer<typeof semproScheduleSchema>
