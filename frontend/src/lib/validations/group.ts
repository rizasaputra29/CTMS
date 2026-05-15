import { z } from "zod"

export const addMemberSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
})

export const createGroupSchema = z.object({
  name: z.string().min(3, "Group name must be at least 3 characters").max(50, "Group name must be at most 50 characters").optional(),
})

export type AddMemberFormData = z.infer<typeof addMemberSchema>
export type CreateGroupFormData = z.infer<typeof createGroupSchema>
