import { z } from "zod"

// Schema for dosen schedule dialog
export const dosenScheduleSchema = z.object({
  group_id: z.string().min(1, "Please select a group"),
  type: z.string(),
  date: z.string().min(1, "Date is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  room: z.string().optional(),
  mode: z.enum(["offline", "online"]),
  notes: z.string().max(1000, "Notes must be at most 1000 characters").optional(),
}).refine((data) => {
  if (data.start_time && data.end_time) {
    return data.start_time < data.end_time
  }
  return true
}, {
  message: "End time must be after start time",
  path: ["end_time"],
}).refine((data) => {
  // Room is required only for offline mode
  if (data.mode === 'offline') {
    return data.room && data.room.trim().length > 0
  }
  return true
}, {
  message: "Room/Location is required for offline mode",
  path: ["room"],
})

export type DosenScheduleFormData = z.infer<typeof dosenScheduleSchema>
