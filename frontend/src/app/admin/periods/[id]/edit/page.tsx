'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PeriodStepper } from '../../components/PeriodStepper';
import { BasicInfoStep } from '../../components/steps/BasicInfoStep';
import { EvaluationSetupStep } from '../../components/steps/EvaluationSetupStep';
import { PhaseDatesStep } from '../../components/steps/PhaseDatesStep';
import { GroupConfigStep } from '../../components/steps/GroupConfigStep';
import { ReviewStep } from '../../components/steps/ReviewStep';
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

export default function EditPeriodPage() {
    const router = useRouter();
    const params = useParams();
    const periodId = params?.id as string;
    
    const [currentStep, setCurrentStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
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

    const { trigger, reset } = methods;

    // Fetch period data
    const fetchPeriod = useCallback(async () => {
        if (!periodId) return;
        
        try {
            const response = await api.get(`/admin/periods/${periodId}`);
            const period = response.data?.data;
            
            if (period) {
                reset({
                    name: period.name || '',
                    start_date: period.start_date ? period.start_date.split('T')[0] : '',
                    end_date: period.end_date ? period.end_date.split('T')[0] : '',
                    is_active: period.is_active || false,
                    bidding_start: period.bidding_start ? period.bidding_start.split('T')[0] : '',
                    bidding_end: period.bidding_end ? period.bidding_end.split('T')[0] : '',
                    bidding_reminder_at: period.bidding_reminder_at ? period.bidding_reminder_at.split('T')[0] : '',
                    pdc1_start: period.pdc1_start ? period.pdc1_start.split('T')[0] : '',
                    pdc1_end: period.pdc1_end ? period.pdc1_end.split('T')[0] : '',
                    pdc1_reminder_at: period.pdc1_reminder_at ? period.pdc1_reminder_at.split('T')[0] : '',
                    pdc2_start: period.pdc2_start ? period.pdc2_start.split('T')[0] : '',
                    pdc2_end: period.pdc2_end ? period.pdc2_end.split('T')[0] : '',
                    pdc2_reminder_at: period.pdc2_reminder_at ? period.pdc2_reminder_at.split('T')[0] : '',
                    expo_date: period.expo_date ? period.expo_date.split('T')[0] : '',
                    expo_reminder_at: period.expo_reminder_at ? period.expo_reminder_at.split('T')[0] : '',
                    ta_start: period.ta_start ? period.ta_start.split('T')[0] : '',
                    ta_end: period.ta_end ? period.ta_end.split('T')[0] : '',
                    ta_reminder_at: period.ta_reminder_at ? period.ta_reminder_at.split('T')[0] : '',
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
            console.error('Failed to fetch period', error);
            toast.error('Gagal memuat data periode');
            router.push('/admin/periods');
        } finally {
            setIsLoading(false);
        }
    }, [periodId, reset, router]);

    // Check evaluation setup
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

    useEffect(() => {
        fetchPeriod();
        checkEvaluationSetup();
    }, [fetchPeriod]);

    const validateStep = async (stepIndex: number): Promise<boolean> => {
        switch (stepIndex) {
            case 0:
                return await trigger(['name', 'start_date', 'end_date', 'is_active']);
            case 1:
                return !!evaluationSetup?.hasTemplates;
            case 2:
                return true;
            case 3:
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
        if (!periodId) return;
        
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
            await api.put(`/admin/periods/${periodId}`, payload);
            toast.success('Periode berhasil diperbarui');
            router.push('/admin/periods');
        } catch (error: unknown) {
            console.error('Failed to update period', error);
            if (api.isAxiosError(error)) {
                toast.error(error.response?.data?.message || 'Gagal memperbarui periode');
            } else {
                toast.error('Gagal memperbarui periode');
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
                        periodId={periodId}
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

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-gray-600">Memuat data periode...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50">
            {/* Header */}
            <div className="sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900">
                                Edit Periode
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Perbarui konfigurasi periode yang sudah ada.
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
                                                Simpan Perubahan
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
