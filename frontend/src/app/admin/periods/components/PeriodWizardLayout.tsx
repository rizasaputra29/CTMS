"use client";

import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PeriodStepper } from "@/app/admin/periods/components/PeriodStepper";

interface Step {
  id: string;
  title: string;
  description: string;
}

interface PeriodWizardLayoutProps {
  title: string;
  description: string;
  steps: Step[];
  currentStep: number;
  isSubmitting: boolean;
  hasEvaluationSetup: boolean;
  onStepClick: (index: number) => void;
  onBack: () => void;
  onNext: () => void;
  onBackToList: () => void;
  children: React.ReactNode;
}

export function PeriodWizardLayout({
  title,
  description,
  steps,
  currentStep,
  isSubmitting,
  hasEvaluationSetup,
  onStepClick,
  onBack,
  onNext,
  onBackToList,
  children,
}: PeriodWizardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-4">
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="px-6 py-6">
            <PeriodStepper
              steps={steps}
              currentStep={currentStep}
              onStepClick={onStepClick}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="p-6">{children}</div>

          <div className="flex items-center justify-between rounded-b-xl border-t bg-gray-50/50 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={currentStep === 0 ? onBackToList : onBack}
              disabled={isSubmitting}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {currentStep === 0 ? "Kembali" : "Sebelumnya"}
            </Button>

            {currentStep === steps.length - 1 ? (
              <Button
                type="submit"
                form="period-wizard-form"
                disabled={isSubmitting || !hasEvaluationSetup}
                className="gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan"
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onNext}
                disabled={currentStep === 1 && !hasEvaluationSetup}
                className="gap-2"
              >
                Lanjut
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
