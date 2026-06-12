"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { ChevronLeft, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import api from "@/lib/api"
import { createUserSchema, type CreateUserFormData } from "@/lib/validations/user"

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

export default function NewUserPage() {
  const router = useRouter()

  const {
    control,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      roles: ["mahasiswa"],
      nim: "",
    },
  })

  const watchedRoles = watch("roles")

  const onSubmit = async (data: CreateUserFormData) => {
    try {
      if (data.roles.includes("mahasiswa") && (!data.nim || data.nim.length < 8)) {
        toast.error("NIM is required for mahasiswa role and must be at least 8 characters")
        return
      }

      const payload: Record<string, unknown> = {
        name: data.name,
        email: data.email,
        password: data.password,
        roles: data.roles,
      }

      if (data.roles.includes("mahasiswa") && data.nim) {
        payload.nim = data.nim
      }

      const response = await api.post("/admin/users", payload)
      toast.success("User created successfully")
      router.push(`/admin/users/${response.data.id}`)
    } catch {
      toast.error("Gagal membuat user")
    }
  }

  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              className="border-grey-100 text-grey-600 hover:bg-grey-25 hover:text-grey-600"
              onClick={() => router.push("/admin/users")}
            >
              <ChevronLeft className="size-4" />
              Kembali
            </Button>
          </div>
          <Button
            type="submit"
            form="new-user-form"
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

        <Card className="shadow-small rounded-xl border-grey-100">
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold text-grey-600 mb-6">
              Tambah User Baru
            </h2>
            <form
              id="new-user-form"
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
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      {...field}
                      id="password"
                      type="password"
                      placeholder="Enter password (min 8 characters)"
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
