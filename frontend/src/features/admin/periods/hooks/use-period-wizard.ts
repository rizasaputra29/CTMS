"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import type { UseFormReturn } from "react-hook-form";
import type { PeriodFormData } from "@/lib/validations/period";

const QUERY_KEY = ["admin", "periods", "wizard"] as const;

const STEPS = [
  {
    id: "basic",
    title: "Informasi Dasar",
    description: "Informasi dasar periode",
  },
  {
    id: "evaluation",
    title: "Setup Evaluasi",
    description: "Konfigurasi penilaian",
  },
  { id: "phases", title: "Tanggal Fase", description: "Jadwal fase-fase" },
  { id: "group", title: "Konfigurasi Group", description: "Pengaturan group" },
  { id: "review", title: "Review", description: "Konfirmasi data" },
];

interface UsePeriodWizardOptions {
  methods: UseFormReturn<PeriodFormData>;
  periodId?: string;
  onSubmitSuccess: () => void;
}

export function usePeriodWizard({
  methods,
  periodId,
  onSubmitSuccess,
}: UsePeriodWizardOptions) {
  const [currentStep, setCurrentStep] = useState(0);

  const { trigger } = methods;

  const evaluationSetupQuery = useQuery({
    queryKey: [...QUERY_KEY, "evaluation-setup"],
    queryFn: async () => {
      const response = await api.get("/admin/evaluation-setup/check");
      return (response.data?.data ?? response.data) as { hasTemplates: boolean; message: string };
    },
    staleTime: Infinity,
    retry: false,
  });

  const evaluationSetup = evaluationSetupQuery.data ?? {
    hasTemplates: true,
    message: "Evaluation setup available",
  };
  const checkingSetup = evaluationSetupQuery.isLoading;

  const submitMutation = useMutation({
    mutationFn: async (data: PeriodFormData) => {
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === "string" && value === "") {
          payload[key] = null;
        } else {
          payload[key] = value;
        }
      }

      if (periodId) {
        await api.put(`/admin/periods/${periodId}`, payload);
      } else {
        await api.post("/admin/periods", payload);
      }
    },
  });

  const validateStep = useCallback(
    async (stepIndex: number): Promise<boolean> => {
      switch (stepIndex) {
        case 0:
          return await trigger(["name", "start_date", "end_date", "is_active"]);
        case 1:
          return !!evaluationSetup?.hasTemplates;
        case 2:
          return true;
        case 3:
          return await trigger([
            "min_group_size",
            "max_group_size",
            "max_supervisor_load",
          ]);
        default:
          return true;
      }
    },
    [trigger, evaluationSetup]
  );

  const handleNext = useCallback(async () => {
    const isValid = await validateStep(currentStep);
    if (!isValid) {
      if (currentStep === 1) {
        toast.error("Silakan lengkapi setup evaluasi terlebih dahulu");
      }
      return;
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, validateStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleStepClick = useCallback(
    async (stepIndex: number) => {
      if (stepIndex === STEPS.length - 1) {
        if (
          currentStep !== STEPS.length - 1 &&
          currentStep !== STEPS.length - 2
        ) {
          toast.info('Silakan klik "Lanjut" untuk melihat review');
          return;
        }
      }

      if (stepIndex <= currentStep + 1) {
        for (let i = 0; i < stepIndex; i++) {
          const isValid = await validateStep(i);
          if (!isValid) {
            toast.error(
              `Silakan lengkapi langkah ${STEPS[i].title} terlebih dahulu`
            );
            setCurrentStep(i);
            return;
          }
        }
        setCurrentStep(stepIndex);
      }
    },
    [currentStep, validateStep]
  );

  const handleSubmit = useCallback(
    async (data: PeriodFormData) => {
      await toast.promise(submitMutation.mutateAsync(data), {
        loading: periodId
          ? "Memperbarui periode..."
          : "Menyimpan periode...",
        success: periodId
          ? "Periode berhasil diperbarui"
          : "Periode berhasil dibuat",
        error: (error) =>
          api.getApiErrorMessage(error, "Gagal menyimpan periode"),
      });
      onSubmitSuccess();
    },
    [submitMutation, periodId, onSubmitSuccess]
  );

  return {
    steps: STEPS,
    currentStep,
    setCurrentStep,
    isSubmitting: submitMutation.isPending,
    evaluationSetup,
    checkingSetup,
    validateStep,
    handleNext,
    handleBack,
    handleStepClick,
    handleSubmit,
  };
}
