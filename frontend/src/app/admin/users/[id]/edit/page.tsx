"use client"

import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import api from "@/lib/api"
import { userSchema, type UserFormData } from "@/lib/validations/user"

interface Role {
  id: number
  name: string
  slug: string
}

interface User {
  id: number
  name: string
  email: string
  nim?: string
  role: string
  roles: Role[]
}

function handleRoleToggle(roles: string[], roleSlug: string, checked: boolean) {
  if (checked) {
    if (roleSlug === "mahasiswa") {
      return ["mahasiswa"]
    }
    const filtered = roles.filter((role) => role !== "mahasiswa")
    if (!filtered.includes(roleSlug)) {
      filtered.push(roleSlug)
    }
    return filtered
  }
  return roles.filter((role) => role !== roleSlug)
}

export default function EditUserPage() {
  const router = useRouter()
  const { id } = useParams()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      roles: ["mahasiswa"],
      nim: "",
    },
  })

  useEffect(() => {
    if (!id) return
    async function fetchUser() {
      try {
        setLoading(true)
        const response = await api.get(`/admin/users/${id}`)
        const data: User = response.data
        setUser(data)

        const roleSlugs: ("admin" | "dosen" | "mahasiswa")[] =
          data.roles && data.roles.length > 0
            ? (data.roles.map((r) => r.slug) as ("admin" | "dosen" | "mahasiswa")[])
            : ([data.role] as ("admin" | "dosen" | "mahasiswa")[])

        reset({
          name: data.name,
          email: data.email,
          password: "",
          roles: roleSlugs,
          nim: data.nim || "",
        })
      } catch {
        setFetchError(true)
        toast.error("Gagal memuat data user")
      } finally {
        setLoading(false)
      }
    }
    fetchUser()
  }, [id, reset])

  const watchedRoles = watch("roles")

  const onSubmit = async (data: UserFormData) => {
    try {
      const payload: Record<string, unknown> = {
        name: data.name,
        email: data.email,
        roles: data.roles,
      }

      if (data.password) {
        payload.password = data.password
      }

      if (data.roles.includes("mahasiswa") && data.nim) {
        payload.nim = data.nim
      }

      await api.put(`/admin/users/${id}`, payload)
      toast.success("User updated successfully")
      router.push(`/admin/users/${id}`)
    } catch {
      toast.error("Gagal menyimpan perubahan")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (fetchError || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-sm font-medium">User tidak ditemukan</p>
        <Button
          variant="link"
          className="mt-2"
          onClick={() => router.push("/admin/users")}
        >
          Kembali ke User Management
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
        {/* Header with breadcrumb and actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              className="border-grey-100 text-grey-600 hover:bg-grey-25 hover:text-grey-600"
              onClick={() => router.push(`/admin/users/${id}`)}
            >
              <ChevronLeft className="size-4" />
              Kembali
            </Button>
          </div>
          <Button
            type="submit"
            form="edit-user-form"
            disabled={isSubmitting}
            size="sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="size-4" />
                Simpan
              </>
            )}
          </Button>
        </div>

        {/* Detail User Card */}
        <Card className="shadow-small rounded-xl border-grey-100">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
              {/* Left side - Title with SSO Badge */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-primary-200 bg-primary-50 text-primary-500 text-xs font-medium h-6 px-2"
                  >
                    SSO
                  </Badge>
                </div>
                <h2 className="text-xl font-semibold text-grey-600">
                  Detail User
                </h2>
                <p className="text-sm text-grey-400">
                  Your users will use this information to contact you.
                </p>
              </div>

              {/* Right side - Form Fields */}
              <form
                id="edit-user-form"
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Nama Lengkap */}
                  <Controller
                    name="name"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="name">
                          Nama Lengkap <span className="text-error-100">*</span>
                        </FieldLabel>
                        <Input
                          {...field}
                          id="name"
                          placeholder="Enter full name"
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />

                  {/* Email */}
                  <Controller
                    name="email"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="email">
                          Email <span className="text-error-100">*</span>
                        </FieldLabel>
                        <Input
                          {...field}
                          id="email"
                          type="email"
                          placeholder="Enter email address"
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />

                  {/* External SSO ID (NIM/NIP) */}
                  <Controller
                    name="nim"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="nim">
                          External SSO ID (NIM/NIP) <span className="text-error-100">*</span>
                        </FieldLabel>
                        <Input
                          {...field}
                          id="nim"
                          placeholder="Enter NIM/NIP"
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </Field>
                    )}
                  />

                  {/* Empty space for layout balance */}
                  <div />
                </div>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* Role & Permissions Card */}
        <Card className="shadow-small rounded-xl border-grey-100">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
              {/* Left side - Title */}
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-grey-600">
                  Role & Permissions
                </h2>
                <p className="text-sm text-grey-400">
                  Manage roles and module permissions for each user
                </p>
              </div>

              {/* Right side - Role Selection */}
              <div className="space-y-4">
                <Controller
                  name="roles"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel>Access Role</FieldLabel>
                      <div className="border border-grey-100 rounded-lg p-4 space-y-3">
                        {(["mahasiswa", "dosen", "admin"] as const).map(
                          (roleSlug) => (
                            <div
                              key={roleSlug}
                              className="flex items-center space-x-3"
                            >
                              <Checkbox
                                id={`role-${roleSlug}`}
                                checked={field.value?.includes(roleSlug)}
                                onCheckedChange={(checked) => {
                                  const newRoles = handleRoleToggle(
                                    field.value || [],
                                    roleSlug,
                                    checked as boolean
                                  )
                                  field.onChange(newRoles)
                                }}
                                aria-invalid={fieldState.invalid}
                              />
                              <label
                                htmlFor={`role-${roleSlug}`}
                                className="text-sm font-medium capitalize cursor-pointer text-grey-600"
                              >
                                {roleSlug === "mahasiswa"
                                  ? "Mahasiswa"
                                  : roleSlug === "dosen"
                                  ? "Dosen"
                                  : "Admin"}
                              </label>
                            </div>
                          )
                        )}
                      </div>
                      {fieldState.error && (
                        <FieldError>{fieldState.error.message}</FieldError>
                      )}
                    </Field>
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  )
}
