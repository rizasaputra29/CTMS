import { z } from "zod"

export const expoEventSchema = z.object({
  period_id: z.string().min(1, "Period is required"),
  name: z.string().min(3, "Event name must be at least 3 characters"),
  date: z.string().min(1, "Date is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  location_id: z.string().min(1, "Location is required"),
  capacity: z.string()
    .min(1, "Capacity is required")
    .refine((val) => !isNaN(Number(val)), "Capacity must be a number")
    .refine((val) => Number(val) >= 1, "Capacity must be at least 1"),
}).refine((data) => {
  if (data.start_time && data.end_time) {
    return data.end_time > data.start_time
  }
  return true
}, {
  message: "End time must be after start time",
  path: ["end_time"],
})

export type ExpoEventFormData = z.infer<typeof expoEventSchema>
