"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import type { UserFormData } from "@/lib/validations/user";
import type { User } from "../types";

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: User | null;
  form: UseFormReturn<UserFormData>;
  onSubmit: (data: UserFormData) => void;
}

const ROLE_OPTIONS = ["admin", "dosen", "mahasiswa"] as const;

function handleRoleToggle(
  roles: string[],
  roleSlug: string,
  checked: boolean
): string[] {
  if (checked) {
    if (roleSlug === "mahasiswa") {
      return ["mahasiswa"];
    } else {
      const filtered = roles.filter((role) => role !== "mahasiswa");
      if (!filtered.includes(roleSlug)) {
        filtered.push(roleSlug);
      }
      return filtered;
    }
  } else {
    return roles.filter((role) => role !== roleSlug);
  }
}

export function UserFormDialog({
  open,
  onOpenChange,
  editing,
  form,
  onSubmit,
}: UserFormDialogProps) {
  const {
    control,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = form;

  const watchedRoles = watch("roles");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit User" : "Add New User"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update user details."
              : "Create a new user account."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    Full Name<span className="mb-1 ml-0.5 text-red-500">*</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
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
                  <FieldLabel htmlFor={field.name}>
                    Email<span className="mb-1 ml-0.5 text-red-500">*</span>
                  </FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
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
                  <FieldLabel htmlFor={field.name}>
                    Password {editing && "(Leave blank to keep current)"}
                    {!editing && (
                      <span className="mb-1 ml-0.5 text-red-500">*</span>
                    )}
                  </FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    type="password"
                    placeholder={
                      editing
                        ? "Enter new password (optional)"
                        : "Enter password"
                    }
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
                  <FieldLabel>
                    Roles<span className="mb-1 ml-0.5 text-red-500">*</span>
                  </FieldLabel>
                  <div className="flex flex-wrap gap-4 mt-2">
                    {ROLE_OPTIONS.map((roleSlug) => (
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
                            );
                            field.onChange(newRoles);
                          }}
                          aria-invalid={fieldState.invalid}
                        />
                        <FieldLabel
                          htmlFor={`role-${roleSlug}`}
                          className="capitalize cursor-pointer"
                        >
                          {roleSlug}
                        </FieldLabel>
                      </div>
                    ))}
                  </div>
                  {fieldState.error && (
                    <FieldError>{fieldState.error.message}</FieldError>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
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
                    <FieldLabel htmlFor={field.name}>
                      NIM<span className="mb-1 ml-0.5 text-red-500">*</span>
                    </FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      placeholder="Enter NIM (min 8 characters)"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.error && (
                      <FieldError>{fieldState.error.message}</FieldError>
                    )}
                  </Field>
                )}
              />
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editing ? "Saving..." : "Creating..."}
                </>
              ) : editing ? (
                "Save Changes"
              ) : (
                "Create User"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
