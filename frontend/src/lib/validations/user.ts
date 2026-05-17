import { z } from "zod"

export const userSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be at most 100 characters"),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address"),
  password: z.string().optional(),
  roles: z.array(z.enum(['admin', 'dosen', 'mahasiswa'])).min(1, "At least one role must be selected"),
  nim: z.string().optional(),
})

export const createUserSchema = userSchema.extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export const editUserSchema = userSchema

export type UserFormData = z.infer<typeof userSchema>
export type CreateUserFormData = z.infer<typeof createUserSchema>
export type EditUserFormData = z.infer<typeof editUserSchema>
