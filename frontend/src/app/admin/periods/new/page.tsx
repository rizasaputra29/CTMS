'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PeriodStepper } from '../components/PeriodStepper';
import { BasicInfoStep } from '../components/steps/BasicInfoStep';
import { EvaluationSetupStep } from '../components/steps/EvaluationSetupStep';
import { PhaseDatesStep } from '../components/steps/PhaseDatesStep';
import { GroupConfigStep } from '../components/steps/GroupConfigStep';
import { ReviewStep } from '../components/steps/ReviewStep';
import { periodSchema, type PeriodFormData } from '@/lib/validations/period';
import api from '@/lib/api';
import { toast } from 'sonner';

const steps = [
    { id: 'basic', title: 'Informasi Dasar', description: 'Informasi dasar periode' },
    { id: 'evaluation', title: 'Setup Evaluasi', description: 'Konfigurasi penilaian' },
    { id: 'phases', title: 'Tanggal Fase', description: 'Jadwal fase-fase' },
    { id: 'group', title: 'Konfigurasi Group', description: 'Pengaturan group' },
    { id: 'review', title: 'Review', description: 'Konfirmasi data' },
];

export default function NewPeriodPage() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [evaluationSetup, setEvaluationSetup] = useState<{ hasTemplates: boolean; message: string } | null>(null);
    const [checkingSetup, setCheckingSetup] = useState(false);

    const methods = useForm<PeriodFormData>({
        resolver: zodResolver(periodSchema),
        mode: 'onBlur',
        defaultValues: {
            name: '',
            start_date: '',
            end_date: '',
            is_active: false,
            bidding_start: '',
            bidding_end: '',
            bidding_reminder_at: '',
            pdc1_start: '',
            pdc1_end: '',
            pdc1_reminder_at: '',
            pdc2_start: '',
            pdc2_end: '',
            pdc2_reminder_at: '',
            expo_date: '',
            expo_reminder_at: '',
            ta_start: '',
            ta_end: '',
            ta_reminder_at: '',
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

    const { trigger, formState: { errors } } = methods;

    // Check evaluation setup on mount
    useEffect(() => {
        checkEvaluationSetup();
    }, []);

    const checkEvaluationSetup = async () => {
        setCheckingSetup(true);
        try {
            const response = await api.get('/admin/evaluation-setup/check');
            setEvaluationSetup(response.data);
        } catch {
            setEvaluationSetup({ hasTemplates: true, message: 'Evaluation setup available' });
        } finally {
            setCheckingSetup(false);
        }
    };

    const validateStep = async (stepIndex: number): Promise<boolean> => {
        switch (stepIndex) {
            case 0: // Basic Info
                return await trigger(['name', 'start_date', 'end_date', 'is_active']);
            case 1: // Evaluation
                return !!evaluationSetup?.hasTemplates;
            case 2: // Phase Dates
                return true; // Optional fields
            case 3: // Group Config
                return await trigger(['min_group_size', 'max_group_size', 'max_supervisor_load']);
            default:
                return true;
        }
    };

    const handleNext = async () => {
        const isValid = await validateStep(currentStep);
        if (!isValid) {
            if (currentStep === 1) {
                toast.error('Silakan lengkapi setup evaluasi terlebih dahulu');
            }
            return;
        }
        
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        } else {
            router.push('/admin/periods');
        }
    };

    const handleStepClick = async (stepIndex: number) => {
        // Prevent direct jump to review step - must go through "Lanjut" button
        // Allow clicking review only if coming from the immediate previous step (group config)
        if (stepIndex === steps.length - 1) {
            // Only allow if we're already on review, or coming from group config step
            if (currentStep !== steps.length - 1 && currentStep !== steps.length - 2) {
                toast.info('Silakan klik "Lanjut" untuk melihat review');
                return;
            }
        }

        // Only allow navigating to completed steps or the next immediate step
        if (stepIndex <= currentStep + 1) {
            // Validate all steps before the target step
            for (let i = 0; i < stepIndex; i++) {
                const isValid = await validateStep(i);
                if (!isValid) {
                    toast.error(`Silakan lengkapi langkah ${steps[i].title} terlebih dahulu`);
                    setCurrentStep(i);
                    return;
                }
            }
            setCurrentStep(stepIndex);
        }
    };

    const handleSubmit = async (data: PeriodFormData) => {
        setIsSubmitting(true);

        const payload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string' && value === '') {
                payload[key] = null;
            } else {
                payload[key] = value;
            }
        }

        try {
            await api.post('/admin/periods', payload);
            toast.success('Periode berhasil dibuat');
            router.push('/admin/periods');
        } catch (error: unknown) {
            console.error('Failed to create period', error);
            if (api.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Gagal membuat periode');
            } else {
                toast.error('Gagal membuat periode');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

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
                return (
                    <ReviewStep 
                        evaluationSetup={evaluationSetup}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* Header */}
            <div className="sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900">
                                Tambah Periode Baru
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Buat periode baru dengan konfigurasi langkah demi langkah.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stepper */}
            <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="bg-white rounded-xl border shadow-sm">
                    <div className="px-6 py-6">
                        <PeriodStepper
                            steps={steps}
                            currentStep={currentStep}
                            onStepClick={handleStepClick}
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                <FormProvider {...methods}>
                    <form onSubmit={methods.handleSubmit(handleSubmit)}>
                        <div className="bg-white rounded-xl border shadow-sm">
                            <div className="p-6">
                                {renderStepContent()}
                            </div>

                            {/* Actions */}
                            <div className="px-6 py-4 border-t bg-gray-50/50 rounded-b-xl flex justify-between items-center">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleBack}
                                    disabled={isSubmitting}
                                    className="gap-2"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    {currentStep === 0 ? 'Kembali' : 'Sebelumnya'}
                                </Button>

                                {currentStep === steps.length - 1 ? (
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting || !evaluationSetup?.hasTemplates}
                                        className="gap-2"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <span className="animate-spin">⏳</span>
                                                Menyimpan...
                                            </>
                                        ) : (
                                            <>
                                                Simpan
                                            </>
                                        )}
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        onClick={handleNext}
                                        disabled={currentStep === 1 && !evaluationSetup?.hasTemplates}
                                        className="gap-2"
                                    >
                                        Lanjut
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </form>
                </FormProvider>
            </div>
        </div>
    );
}
