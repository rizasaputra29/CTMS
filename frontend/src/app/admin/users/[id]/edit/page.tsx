"use client"

import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Card, CardContent } from "@/components/ui/card"
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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (fetchError || !user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
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
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="/admin/users"
                  className="text-sm font-normal text-grey-400 hover:text-grey-600"
                >
                  SICATA
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-grey-400" />
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="/admin/users"
                  className="text-sm font-normal text-grey-400 hover:text-grey-600"
                >
                  User Management
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-grey-400" />
              <BreadcrumbItem>
                <BreadcrumbLink
                  href={`/admin/users/${id}`}
                  className="text-sm font-normal text-grey-400 hover:text-grey-600 truncate max-w-32"
                >
                  {user.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="text-grey-400" />
              <BreadcrumbItem>
                <span className="text-sm font-semibold text-grey-600">
                  Edit
                </span>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
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
              Simpan Perubahan
            </>
          )}
        </Button>
      </div>

      <Card className="shadow-small rounded-[8px] border-grey-100">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold text-grey-600 mb-6">
            Edit User Information
          </h2>
          <form
            id="edit-user-form"
            onSubmit={handleSubmit(onSubmit)}
            className="grid grid-cols-1 gap-6 md:grid-cols-2"
          >
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="name">Full Name</FieldLabel>
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

            <Controller
              name="email"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
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

            <Controller
              name="password"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="password">
                    Password{" "}
                    <span className="text-grey-400 font-normal">
                      (Leave blank to keep current)
                    </span>
                  </FieldLabel>
                  <Input
                    {...field}
                    id="password"
                    type="password"
                    placeholder="Enter new password (optional)"
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.error && (
                    <FieldError>{fieldState.error.message}</FieldError>
                  )}
                </Field>
              )}
            />

            <Controller
              name="roles"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Roles</FieldLabel>
                  <div className="flex flex-wrap gap-4 mt-2">
                    {(["admin", "dosen", "mahasiswa"] as const).map(
                      (roleSlug) => (
                        <div
                          key={roleSlug}
                          className="flex items-center space-x-2"
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
                            {roleSlug}
                          </label>
                        </div>
                      )
                    )}
                  </div>
                  {fieldState.error && (
                    <FieldError>{fieldState.error.message}</FieldError>
                  )}
                  <p className="text-xs text-grey-400 mt-1">
                    Role mahasiswa harus berdiri sendiri (tidak bisa digabung
                    dengan admin/dosen).
                  </p>
                </Field>
              )}
            />

            {watchedRoles?.includes("mahasiswa") && (
              <Controller
                name="nim"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="nim">NIM</FieldLabel>
                    <Input
                      {...field}
                      id="nim"
                      placeholder="Enter NIM (min 8 characters)"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.error ? (
                      <FieldError>{fieldState.error.message}</FieldError>
                    ) : (
                      field.value &&
                      field.value.length > 0 &&
                      field.value.length < 8 && (
                        <FieldError>
                          NIM must be at least 8 characters
                        </FieldError>
                      )
                    )}
                  </Field>
                )}
              />
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
