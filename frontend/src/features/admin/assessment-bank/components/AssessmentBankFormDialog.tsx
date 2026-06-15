"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, type UseFormReturn } from "react-hook-form";
import { ArrowLeft, Loader2, HelpCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AssessmentBankTemplateFormData } from "@/lib/validations/assessment";

interface AssessmentBankFormDialogProps {
  mode: "create" | "edit";
  form: UseFormReturn<AssessmentBankTemplateFormData>;
  onSubmit: (data: AssessmentBankTemplateFormData) => Promise<void>;
  isSubmitting: boolean;
}

export function AssessmentBankFormDialog({
  mode,
  form,
  onSubmit,
  isSubmitting,
}: AssessmentBankFormDialogProps) {
  const router = useRouter();
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const { control, handleSubmit, formState, watch, setValue } = form;
  const { isDirty } = formState;
  const descriptionValue = watch("description") || "";
  const codeValue = watch("code") || "";

  // Keep name in sync with code to match the existing backend pattern.
  useEffect(() => {
    setValue("name", codeValue, { shouldValidate: false, shouldDirty: false });
  }, [codeValue, setValue]);

  // Warn users when leaving the page with unsaved changes.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleBack = () => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      router.push("/admin/assessment-bank");
    }
  };

  const confirmNavigation = () => {
    setShowUnsavedDialog(false);
    router.push("/admin/assessment-bank");
  };

  const cancelNavigation = () => {
    setShowUnsavedDialog(false);
  };

  const handleFormSubmit = async (data: AssessmentBankTemplateFormData) => {
    await onSubmit({ ...data, name: data.code });
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <ConfirmDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        title="Perubahan Belum Disimpan"
        description="Anda memiliki perubahan yang belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?"
        confirmLabel="Tinggalkan Halaman"
        cancelLabel="Batal"
        variant="destructive"
        onConfirm={confirmNavigation}
      />

      {/* Header */}
      <div className="sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {mode === "create"
                    ? "Tambah Komponen Penilaian"
                    : "Edit Komponen Penilaian"}
                </h1>
                <p className="text-sm text-gray-500">
                  {mode === "create"
                    ? "Buat komponen penilaian baru untuk digunakan dalam berbagai periode."
                    : "Ubah informasi komponen penilaian yang sudah ada."}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                Kembali
              </Button>
              <Button
                type="submit"
                form="assessment-bank-form"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Card className="shadow-sm">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Informasi Penilaian
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form
              id="assessment-bank-form"
              onSubmit={handleSubmit(handleFormSubmit)}
              className="max-w-2xl space-y-6"
            >
              <Controller
                name="code"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>
                      Kode{" "}
                      <span className="text-red-500">*</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="ml-1 inline h-4 w-4 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Kode unik untuk mengidentifikasi komponen
                              penilaian
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      placeholder="Contoh: CPL-001"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError>{fieldState.error?.message}</FieldError>
                    )}
                    <FieldDescription>
                      Kode harus unik dan tidak boleh sama dengan komponen lain.
                    </FieldDescription>
                  </Field>
                )}
              />

              <Controller
                name="description"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <div className="flex items-center justify-between">
                      <FieldLabel htmlFor={field.name}>
                        Deskripsi{" "}
                        <span className="text-red-500">*</span>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="ml-1 inline h-4 w-4 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                Penjelasan detail tentang komponen penilaian ini
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FieldLabel>
                      <span
                        className={`text-xs ${
                          descriptionValue.length > 200
                            ? "text-red-500"
                            : "text-gray-400"
                        }`}
                      >
                        {descriptionValue.length}/200
                      </span>
                    </div>
                    <Textarea
                      {...field}
                      id={field.name}
                      placeholder="Masukkan deskripsi komponen penilaian..."
                      rows={4}
                      maxLength={200}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError>{fieldState.error?.message}</FieldError>
                    )}
                  </Field>
                )}
              />

              <Controller
                name="weight"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>
                      Bobot{" "}
                      <span className="text-red-500">*</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="ml-1 inline h-4 w-4 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Persentase bobot penilaian (0-100)</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FieldLabel>
                    <div className="flex items-center gap-3">
                      <Input
                        {...field}
                        id={field.name}
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        placeholder="0"
                        className="w-32"
                        aria-invalid={fieldState.invalid}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? 0
                              : parseFloat(e.target.value)
                          )
                        }
                      />
                      <span className="text-sm text-gray-500">%</span>
                      <Badge
                        variant="outline"
                        className="bg-indigo-50 text-indigo-700 border-indigo-200"
                      >
                        Total bobot harus 100% per fase
                      </Badge>
                    </div>
                    {fieldState.invalid && (
                      <FieldError>{fieldState.error?.message}</FieldError>
                    )}
                  </Field>
                )}
              />

              <Controller
                name="is_active"
                control={control}
                render={({ field, fieldState }) => (
                  <Field
                    orientation="horizontal"
                    data-invalid={fieldState.invalid}
                  >
                    <FieldLabel htmlFor={field.name}>
                      Set Aktif{" "}
                      <span className="text-red-500">*</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="ml-1 inline h-4 w-4 text-gray-400" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              Tentukan apakah komponen ini aktif dan dapat
                              digunakan
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FieldLabel>
                    <Switch
                      id={field.name}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && (
                      <FieldError>{fieldState.error?.message}</FieldError>
                    )}
                  </Field>
                )}
              />
              <p className="text-xs text-gray-500">
                Komponen nonaktif tidak akan ditampilkan saat konfigurasi
                penilaian.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
