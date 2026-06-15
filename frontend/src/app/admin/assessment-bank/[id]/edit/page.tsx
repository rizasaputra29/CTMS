"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  assessmentBankTemplateSchema,
  type AssessmentBankTemplateFormData,
} from "@/lib/validations/assessment";
import {
  AssessmentBankFormDialog,
  useAssessmentBank,
  type AssessmentTemplate,
} from "@/features/admin/assessment-bank";

const QUERY_KEY = ["admin", "assessment-templates"] as const;

export default function EditAssessmentBankPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = Number(params?.id);
  const { updateTemplate } = useAssessmentBank();

  const {
    data: template,
    isLoading,
    isError,
  } = useQuery<AssessmentTemplate>({
    queryKey: [...QUERY_KEY, templateId],
    queryFn: async () => {
      const res = await api.get(`/admin/assessment-templates/${templateId}`);
      return res.data?.data || res.data;
    },
    enabled: !!templateId,
  });

  const form = useForm<AssessmentBankTemplateFormData>({
    resolver: zodResolver(assessmentBankTemplateSchema),
    mode: "onBlur",
    defaultValues: {
      code: "",
      name: "",
      description: "",
      weight: 0,
      is_active: true,
    },
  });

  const { reset } = form;

  useEffect(() => {
    if (template) {
      reset({
        code: template.code,
        name: template.name,
        description: template.description || "",
        weight: Number(template.weight),
        is_active: template.is_active,
      });
    }
  }, [template, reset]);

  useEffect(() => {
    if (isError) {
      toast.error("Gagal memuat data komponen");
      router.push("/admin/assessment-bank");
    }
  }, [isError, router]);

  const handleSubmit = async (data: AssessmentBankTemplateFormData) => {
    if (!templateId) return;
    try {
      await updateTemplate(templateId, data);
      router.push("/admin/assessment-bank");
    } catch {
      // Error toast is already shown by the hook.
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-gray-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (isError || !template) {
    return null;
  }

  return (
    <AssessmentBankFormDialog
      mode="edit"
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={form.formState.isSubmitting}
    />
  );
}
