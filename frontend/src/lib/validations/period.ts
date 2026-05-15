import { z } from "zod"

export const periodSchema = z.object({
  name: z.string().min(3, "Period name must be at least 3 characters").max(100, "Period name must be at most 100 characters"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
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
  min_group_size: z.number().min(1, "Minimum group size must be at least 1").max(10, "Maximum is 10"),
  max_group_size: z.number().min(1, "Maximum group size must be at least 1").max(10, "Maximum is 10"),
  max_supervisor_load: z.number().min(1, "Maximum supervisor load must be at least 1").max(20, "Maximum is 20"),
}).refine((data) => {
  if (data.start_date && data.end_date) {
    return new Date(data.start_date) <= new Date(data.end_date)
  }
  return true
}, {
  message: "End date must be after start date",
  path: ["end_date"],
})

export type PeriodFormData = z.infer<typeof periodSchema>
