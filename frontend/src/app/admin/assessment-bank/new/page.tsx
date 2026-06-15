"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  assessmentBankTemplateSchema,
  type AssessmentBankTemplateFormData,
} from "@/lib/validations/assessment";
import {
  AssessmentBankFormDialog,
  useAssessmentBank,
} from "@/features/admin/assessment-bank";

export default function NewAssessmentBankPage() {
  const router = useRouter();
  const { createTemplate } = useAssessmentBank();

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

  const handleSubmit = async (data: AssessmentBankTemplateFormData) => {
    try {
      await createTemplate(data);
      router.push("/admin/assessment-bank");
    } catch {
      // Error toast is already shown by the hook.
    }
  };

  return (
    <AssessmentBankFormDialog
      mode="create"
      form={form}
      onSubmit={handleSubmit}
      isSubmitting={form.formState.isSubmitting}
    />
  );
}
