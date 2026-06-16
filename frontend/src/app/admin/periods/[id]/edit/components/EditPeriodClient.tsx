"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { periodSchema, type PeriodFormData } from "@/lib/validations/period";
import api from "@/lib/api";
import { toast } from "sonner";
import { usePeriodWizard } from "@/features/admin/periods";
import { PeriodWizardLayout } from "../../../components/PeriodWizardLayout";
import { BasicInfoStep } from "../../../components/steps/BasicInfoStep";
import { EvaluationSetupStep } from "../../../components/steps/EvaluationSetupStep";
import { PhaseDatesStep } from "../../../components/steps/PhaseDatesStep";
import { GroupConfigStep } from "../../../components/steps/GroupConfigStep";
import { ReviewStep } from "../../../components/steps/ReviewStep";

export default function EditPeriodClient() {
  const router = useRouter();
  const params = useParams();
  const periodId = params?.id as string;
  const [isLoading, setIsLoading] = useState(true);

  const methods = useForm<PeriodFormData>({
    resolver: zodResolver(periodSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      start_date: "",
      end_date: "",
      is_active: false,
      bidding_start: "",
      bidding_end: "",
      bidding_reminder_at: "",
      pdc1_start: "",
      pdc1_end: "",
      pdc1_reminder_at: "",
      pdc2_start: "",
      pdc2_end: "",
      pdc2_reminder_at: "",
      expo_date: "",
      expo_reminder_at: "",
      ta_start: "",
      ta_end: "",
      ta_reminder_at: "",
      min_group_size: 3,
      max_group_size: 4,
      max_supervisor_load: 5,
      evaluation_configs: {
        sidang_ta: { components: [], totalWeight: 0 },
        expo: { components: [], totalWeight: 0 },
        bimbingan_sempro: { components: [], totalWeight: 0 },
        bimbingan_ta: { components: [], totalWeight: 0 },
        nilai_dosen: { components: [], totalWeight: 0 },
        milestone: { components: [], totalWeight: 0 },
      },
      peer_review_config: {
        indicators: [],
        enabled: false,
        totalWeight: 0,
      },
    },
  });

  const { reset } = methods;

  const fetchPeriod = useCallback(async () => {
    if (!periodId) return;
    try {
      const response = await api.get(`/admin/periods/${periodId}`);
      const period = response.data?.data;
      if (period) {
        reset({
          name: period.name || "",
          start_date: period.start_date ? period.start_date.split("T")[0] : "",
          end_date: period.end_date ? period.end_date.split("T")[0] : "",
          is_active: period.is_active || false,
          bidding_start: period.bidding_start
            ? period.bidding_start.split("T")[0]
            : "",
          bidding_end: period.bidding_end
            ? period.bidding_end.split("T")[0]
            : "",
          bidding_reminder_at: period.bidding_reminder_at
            ? period.bidding_reminder_at.split("T")[0]
            : "",
          pdc1_start: period.pdc1_start ? period.pdc1_start.split("T")[0] : "",
          pdc1_end: period.pdc1_end ? period.pdc1_end.split("T")[0] : "",
          pdc1_reminder_at: period.pdc1_reminder_at
            ? period.pdc1_reminder_at.split("T")[0]
            : "",
          pdc2_start: period.pdc2_start ? period.pdc2_start.split("T")[0] : "",
          pdc2_end: period.pdc2_end ? period.pdc2_end.split("T")[0] : "",
          pdc2_reminder_at: period.pdc2_reminder_at
            ? period.pdc2_reminder_at.split("T")[0]
            : "",
          expo_date: period.expo_date ? period.expo_date.split("T")[0] : "",
          expo_reminder_at: period.expo_reminder_at
            ? period.expo_reminder_at.split("T")[0]
            : "",
          ta_start: period.ta_start ? period.ta_start.split("T")[0] : "",
          ta_end: period.ta_end ? period.ta_end.split("T")[0] : "",
          ta_reminder_at: period.ta_reminder_at
            ? period.ta_reminder_at.split("T")[0]
            : "",
          min_group_size: period.min_group_size ?? 3,
          max_group_size: period.max_group_size ?? 4,
          max_supervisor_load: period.max_supervisor_load ?? 5,
          evaluation_configs: period.evaluation_configs || {
            sidang_ta: { components: [], totalWeight: 0 },
            expo: { components: [], totalWeight: 0 },
            bimbingan_sempro: { components: [], totalWeight: 0 },
            bimbingan_ta: { components: [], totalWeight: 0 },
            nilai_dosen: { components: [], totalWeight: 0 },
            milestone: { components: [], totalWeight: 0 },
          },
          peer_review_config: period.peer_review_config || {
            indicators: [],
            enabled: false,
            totalWeight: 0,
          },
        });
      }
    } catch (error) {
      console.error("Failed to fetch period", error);
      toast.error("Gagal memuat data periode");
      router.push("/admin/periods");
    } finally {
      setIsLoading(false);
    }
  }, [periodId, reset, router]);

  useEffect(() => {
    fetchPeriod();
  }, [fetchPeriod]);

  const {
    steps,
    currentStep,
    isSubmitting,
    evaluationSetup,
    checkingSetup,
    handleNext,
    handleBack,
    handleStepClick,
    handleSubmit,
  } = usePeriodWizard({
    methods,
    periodId,
    onSubmitSuccess: () => router.push("/admin/periods"),
  });

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <BasicInfoStep />;
      case 1:
        return (
          <EvaluationSetupStep
            evaluationSetup={evaluationSetup}
            checkingSetup={checkingSetup}
            periodId={periodId}
          />
        );
      case 2:
        return <PhaseDatesStep />;
      case 3:
        return <GroupConfigStep />;
      case 4:
        return <ReviewStep />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50/50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Memuat data periode...</p>
        </div>
      </div>
    );
  }

  return (
    <PeriodWizardLayout
      title="Edit Periode"
      description="Perbarui konfigurasi periode yang sudah ada."
      steps={steps}
      currentStep={currentStep}
      isSubmitting={isSubmitting}
      hasEvaluationSetup={evaluationSetup?.hasTemplates ?? true}
      onStepClick={handleStepClick}
      onBack={handleBack}
      onNext={handleNext}
      onBackToList={() => router.push("/admin/periods")}
    >
      <FormProvider {...methods}>
        <form
          id="period-wizard-form"
          onSubmit={methods.handleSubmit(handleSubmit)}
        >
          {renderStepContent()}
        </form>
      </FormProvider>
    </PeriodWizardLayout>
  );
}
