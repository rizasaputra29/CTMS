"use client";

import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { periodSchema, type PeriodFormData } from "@/lib/validations/period";
import { usePeriodWizard } from "@/features/admin/periods";
import { PeriodWizardLayout } from "../components/PeriodWizardLayout";
import { BasicInfoStep } from "../components/steps/BasicInfoStep";
import { EvaluationSetupStep } from "../components/steps/EvaluationSetupStep";
import { PhaseDatesStep } from "../components/steps/PhaseDatesStep";
import { GroupConfigStep } from "../components/steps/GroupConfigStep";
import { ReviewStep } from "../components/steps/ReviewStep";

export default function NewPeriodPage() {
  const router = useRouter();

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

  return (
    <PeriodWizardLayout
      title="Tambah Periode Baru"
      description="Buat periode baru dengan konfigurasi langkah demi langkah."
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
