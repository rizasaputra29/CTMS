'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Stepper, StepperContent, StepperActions } from '@/components/ui/stepper';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, BookOpen, GraduationCap, Users, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from "sonner";
import api from '@/lib/api';
import { periodSchema, type PeriodFormData } from '@/lib/validations/period';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';

interface PeriodStepperDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingPeriod?: Period | null;
    onSuccess: () => void;
}

interface Period {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
    bidding_start: string | null;
    bidding_end: string | null;
    bidding_reminder_at?: string | null;
    pdc1_start: string | null;
    pdc1_end: string | null;
    pdc1_reminder_at?: string | null;
    pdc2_start: string | null;
    pdc2_end: string | null;
    pdc2_reminder_at?: string | null;
    expo_date: string | null;
    expo_reminder_at?: string | null;
    ta_start: string | null;
    ta_end: string | null;
    ta_reminder_at?: string | null;
    min_group_size: number | null;
    max_group_size: number | null;
    max_supervisor_load: number | null;
}

const steps = [
    { title: 'Basic Info', description: 'Period details' },
    { title: 'Evaluation Setup', description: 'Check templates' },
    { title: 'Phase Dates', description: 'Schedule phases' },
    { title: 'Group Config', description: 'Group settings' },
    { title: 'Review', description: 'Confirm details' },
];

export function PeriodStepperDialog({ open, onOpenChange, editingPeriod, onSuccess }: PeriodStepperDialogProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [evaluationSetup, setEvaluationSetup] = useState<{ hasTemplates: boolean; message: string } | null>(null);
    const [checkingSetup, setCheckingSetup] = useState(false);

    const form = useForm<PeriodFormData>({
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
        },
    });

    const formValues = form.watch();

    // Reset form when dialog opens/closes or editingPeriod changes
    useEffect(() => {
        if (open) {
            if (editingPeriod) {
                form.reset({
                    name: editingPeriod.name,
                    start_date: editingPeriod.start_date ? editingPeriod.start_date.split('T')[0] : '',
                    end_date: editingPeriod.end_date ? editingPeriod.end_date.split('T')[0] : '',
                    is_active: editingPeriod.is_active,
                    bidding_start: editingPeriod.bidding_start ? editingPeriod.bidding_start.split('T')[0] : '',
                    bidding_end: editingPeriod.bidding_end ? editingPeriod.bidding_end.split('T')[0] : '',
                    bidding_reminder_at: editingPeriod.bidding_reminder_at ? editingPeriod.bidding_reminder_at.split('T')[0] : '',
                    pdc1_start: editingPeriod.pdc1_start ? editingPeriod.pdc1_start.split('T')[0] : '',
                    pdc1_end: editingPeriod.pdc1_end ? editingPeriod.pdc1_end.split('T')[0] : '',
                    pdc1_reminder_at: editingPeriod.pdc1_reminder_at ? editingPeriod.pdc1_reminder_at.split('T')[0] : '',
                    pdc2_start: editingPeriod.pdc2_start ? editingPeriod.pdc2_start.split('T')[0] : '',
                    pdc2_end: editingPeriod.pdc2_end ? editingPeriod.pdc2_end.split('T')[0] : '',
                    pdc2_reminder_at: editingPeriod.pdc2_reminder_at ? editingPeriod.pdc2_reminder_at.split('T')[0] : '',
                    expo_date: editingPeriod.expo_date ? editingPeriod.expo_date.split('T')[0] : '',
                    expo_reminder_at: editingPeriod.expo_reminder_at ? editingPeriod.expo_reminder_at.split('T')[0] : '',
                    ta_start: editingPeriod.ta_start ? editingPeriod.ta_start.split('T')[0] : '',
                    ta_end: editingPeriod.ta_end ? editingPeriod.ta_end.split('T')[0] : '',
                    ta_reminder_at: editingPeriod.ta_reminder_at ? editingPeriod.ta_reminder_at.split('T')[0] : '',
                    min_group_size: editingPeriod.min_group_size ?? 3,
                    max_group_size: editingPeriod.max_group_size ?? 4,
                    max_supervisor_load: editingPeriod.max_supervisor_load ?? 5,
                });
            } else {
                form.reset({
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
                });
            }
            setCurrentStep(0);
            checkEvaluationSetup();
        }
    }, [open, editingPeriod, form]);

    const checkEvaluationSetup = async () => {
        setCheckingSetup(true);
        try {
            const response = await api.get('/admin/evaluation-setup/check');
            setEvaluationSetup(response.data?.data ?? response.data);
        } catch {
            setEvaluationSetup({ hasTemplates: true, message: 'Evaluation setup available' });
        } finally {
            setCheckingSetup(false);
        }
    };

    const handleNext = async () => {
        if (currentStep === 0) {
            const isValid = await form.trigger(['name', 'start_date', 'end_date']);
            if (!isValid) return;
        }
        if (currentStep === 1 && !evaluationSetup?.hasTemplates) {
            toast.error('Please complete evaluation setup first');
            return;
        }
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = async (data: PeriodFormData) => {
        setSubmitting(true);

        const payload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string' && value === '') {
                payload[key] = null;
            } else {
                payload[key] = value;
            }
        }

        try {
            if (editingPeriod) {
                await api.put(`/admin/periods/${editingPeriod.id}`, payload);
                toast.success('Period updated successfully');
            } else {
                await api.post('/admin/periods', payload);
                toast.success('Period created successfully');
            }
            onOpenChange(false);
            onSuccess();
        } catch (error: unknown) {
            console.error('Failed to save period', error);
            if (api.isAxiosError(error)) {
                toast.error(api.getApiErrorMessage(error, 'Failed to save period'));
            } else {
                toast.error('Failed to save period');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Step 1: Basic Info
    const BasicInfoStep = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <CalendarIcon className="h-4 w-4" />
                <span>Enter the basic information for this academic period</span>
            </div>
            <div className="grid gap-4">
                <Field>
                    <FieldLabel htmlFor="name">Period Name *</FieldLabel>
                    <Controller
                        name="name"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Input
                                id="name"
                                placeholder="e.g. Semester Ganjil 2025/2026"
                                {...field}
                                data-invalid={fieldState.error ? '' : undefined}
                                aria-invalid={fieldState.error ? 'true' : 'false'}
                            />
                        )}
                    />
                    <FieldError>{form.formState.errors.name?.message}</FieldError>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field>
                        <FieldLabel htmlFor="start_date">Start Date *</FieldLabel>
                        <Controller
                            name="start_date"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Input
                                    id="start_date"
                                    type="date"
                                    {...field}
                                    data-invalid={fieldState.error ? '' : undefined}
                                    aria-invalid={fieldState.error ? 'true' : 'false'}
                                />
                            )}
                        />
                        <FieldError>{form.formState.errors.start_date?.message}</FieldError>
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="end_date">End Date *</FieldLabel>
                        <Controller
                            name="end_date"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Input
                                    id="end_date"
                                    type="date"
                                    {...field}
                                    data-invalid={fieldState.error ? '' : undefined}
                                    aria-invalid={fieldState.error ? 'true' : 'false'}
                                />
                            )}
                        />
                        <FieldError>{form.formState.errors.end_date?.message}</FieldError>
                    </Field>
                </div>
                <Controller
                    name="is_active"
                    control={form.control}
                    render={({ field }) => (
                        <div className="flex items-center space-x-2 pt-2">
                            <Switch
                                id="is-active"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                            <label htmlFor="is-active" className="text-sm font-medium">Set as Active Period</label>
                        </div>
                    )}
                />
            </div>
        </div>
    );

    // Step 2: Evaluation Setup Check
    const EvaluationSetupStep = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <BookOpen className="h-4 w-4" />
                <span>Verify evaluation templates are configured</span>
            </div>
            {checkingSetup ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : evaluationSetup ? (
                <div className={`p-4 rounded-lg border ${evaluationSetup.hasTemplates ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                    <div className="flex items-start gap-3">
                        {evaluationSetup.hasTemplates ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        ) : (
                            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                        )}
                        <div>
                            <h4 className={`font-medium ${evaluationSetup.hasTemplates ? 'text-green-900' : 'text-yellow-900'}`}>
                                {evaluationSetup.hasTemplates ? 'Evaluation Setup Ready' : 'Evaluation Setup Required'}
                            </h4>
                            <p className={`text-sm mt-1 ${evaluationSetup.hasTemplates ? 'text-green-700' : 'text-yellow-700'}`}>
                                {evaluationSetup.message}
                            </p>
                            {!evaluationSetup.hasTemplates && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="mt-3"
                                    onClick={() => window.open('/admin/evaluation-setup', '_blank')}
                                >
                                    Go to Evaluation Setup
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
                Evaluation templates must be configured before creating a period to ensure proper grading workflows.
            </p>
        </div>
    );

    // Step 3: Phase Dates
    const PhaseDatesStep = () => (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <GraduationCap className="h-4 w-4" />
                <span>Set dates for each phase of the academic period</span>
            </div>
            <div className="grid gap-4">
                {/* Bidding Window */}
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                    <label className="font-medium flex items-center gap-2 text-sm">
                        Bidding Window
                        <span className="text-xs font-normal text-muted-foreground">(Main dates)</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <Field>
                            <FieldLabel htmlFor="bidding_start" className="text-xs text-muted-foreground">Start</FieldLabel>
                            <Controller
                                name="bidding_start"
                                control={form.control}
                                render={({ field }) => (
                                    <Input
                                        id="bidding_start"
                                        type="date"
                                        {...field}
                                        value={field.value || ''}
                                    />
                                )}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="bidding_end" className="text-xs text-muted-foreground">End</FieldLabel>
                            <Controller
                                name="bidding_end"
                                control={form.control}
                                render={({ field }) => (
                                    <Input
                                        id="bidding_end"
                                        type="date"
                                        {...field}
                                        value={field.value || ''}
                                    />
                                )}
                            />
                        </Field>
                    </div>
                    <Field>
                        <FieldLabel htmlFor="bidding_reminder_at" className="text-xs text-muted-foreground flex items-center gap-1">
                            Reminder Date
                            <span className="text-[10px] text-blue-600">(When to notify)</span>
                        </FieldLabel>
                        <Controller
                            name="bidding_reminder_at"
                            control={form.control}
                            render={({ field }) => (
                                <Input
                                    id="bidding_reminder_at"
                                    type="date"
                                    {...field}
                                    value={field.value || ''}
                                    className="h-8"
                                />
                            )}
                        />
                    </Field>
                </div>
                
                <Separator />
                
                {/* PDC1 Phase */}
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                    <label className="font-medium flex items-center gap-2 text-sm">
                        PDC1 Phase
                        <span className="text-xs font-normal text-muted-foreground">(Main dates)</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <Field>
                            <FieldLabel htmlFor="pdc1_start" className="text-xs text-muted-foreground">Start</FieldLabel>
                            <Controller
                                name="pdc1_start"
                                control={form.control}
                                render={({ field }) => (
                                    <Input
                                        id="pdc1_start"
                                        type="date"
                                        {...field}
                                        value={field.value || ''}
                                    />
                                )}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="pdc1_end" className="text-xs text-muted-foreground">End</FieldLabel>
                            <Controller
                                name="pdc1_end"
                                control={form.control}
                                render={({ field }) => (
                                    <Input
                                        id="pdc1_end"
                                        type="date"
                                        {...field}
                                        value={field.value || ''}
                                    />
                                )}
                            />
                        </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <Field>
                            <FieldLabel htmlFor="pdc1_reminder_at" className="text-xs text-muted-foreground flex items-center gap-1">
                                Reminder
                                <span className="text-[10px] text-blue-600">(Notify)</span>
                            </FieldLabel>
                            <Controller
                                name="pdc1_reminder_at"
                                control={form.control}
                                render={({ field }) => (
                                    <Input
                                        id="pdc1_reminder_at"
                                        type="date"
                                        {...field}
                                        value={field.value || ''}
                                        className="h-8"
                                    />
                                )}
                            />
                        </Field>
                    </div>
                </div>
                
                <Separator />
                
                {/* PDC2 Phase */}
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                    <label className="font-medium flex items-center gap-2 text-sm">
                        PDC2 Phase
                        <span className="text-xs font-normal text-muted-foreground">(Main dates)</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <Field>
                            <FieldLabel htmlFor="pdc2_start" className="text-xs text-muted-foreground">Start</FieldLabel>
                            <Controller
                                name="pdc2_start"
                                control={form.control}
                                render={({ field }) => (
                                    <Input
                                        id="pdc2_start"
                                        type="date"
                                        {...field}
                                        value={field.value || ''}
                                    />
                                )}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="pdc2_end" className="text-xs text-muted-foreground">End</FieldLabel>
                            <Controller
                                name="pdc2_end"
                                control={form.control}
                                render={({ field }) => (
                                    <Input
                                        id="pdc2_end"
                                        type="date"
                                        {...field}
                                        value={field.value || ''}
                                    />
                                )}
                            />
                        </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <Field>
                            <FieldLabel htmlFor="pdc2_reminder_at" className="text-xs text-muted-foreground flex items-center gap-1">
                                Reminder
                                <span className="text-[10px] text-blue-600">(Notify)</span>
                            </FieldLabel>
                            <Controller
                                name="pdc2_reminder_at"
                                control={form.control}
                                render={({ field }) => (
                                    <Input
                                        id="pdc2_reminder_at"
                                        type="date"
                                        {...field}
                                        value={field.value || ''}
                                        className="h-8"
                                    />
                                )}
                            />
                        </Field>
                    </div>
                </div>
                
                <Separator />
                
                {/* EXPO */}
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                    <label className="font-medium flex items-center gap-2 text-sm">
                        Expo Date
                        <span className="text-xs font-normal text-muted-foreground">(Main date)</span>
                    </label>
                    <Field>
                        <FieldLabel htmlFor="expo_date" className="text-xs text-muted-foreground">Date</FieldLabel>
                        <Controller
                            name="expo_date"
                            control={form.control}
                            render={({ field }) => (
                                <Input
                                    id="expo_date"
                                    type="date"
                                    {...field}
                                    value={field.value || ''}
                                />
                            )}
                        />
                    </Field>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <Field>
                            <FieldLabel htmlFor="expo_reminder_at" className="text-xs text-muted-foreground flex items-center gap-1">
                                Reminder
                                <span className="text-[10px] text-blue-600">(Notify)</span>
                            </FieldLabel>
                            <Controller
                                name="expo_reminder_at"
                                control={form.control}
                                render={({ field }) => (
                                    <Input
                                        id="expo_reminder_at"
                                        type="date"
                                        {...field}
                                        value={field.value || ''}
                                        className="h-8"
                                    />
                                )}
                            />
                        </Field>
                    </div>
                </div>
                
                <Separator />
                
                {/* TA Defense */}
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                    <label className="font-medium flex items-center gap-2 text-sm">
                        TA Defense Period
                        <span className="text-xs font-normal text-muted-foreground">(Main dates)</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <Field>
                            <FieldLabel htmlFor="ta_start" className="text-xs text-muted-foreground">Start</FieldLabel>
                            <Controller
                                name="ta_start"
                                control={form.control}
                                render={({ field }) => (
                                    <Input
                                        id="ta_start"
                                        type="date"
                                        {...field}
                                        value={field.value || ''}
                                    />
                                )}
                            />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="ta_end" className="text-xs text-muted-foreground">End</FieldLabel>
                            <Controller
                                name="ta_end"
                                control={form.control}
                                render={({ field }) => (
                                    <Input
                                        id="ta_end"
                                        type="date"
                                        {...field}
                                        value={field.value || ''}
                                    />
                                )}
                            />
                        </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <Field>
                            <FieldLabel htmlFor="ta_reminder_at" className="text-xs text-muted-foreground flex items-center gap-1">
                                Reminder
                                <span className="text-[10px] text-blue-600">(Notify)</span>
                            </FieldLabel>
                            <Controller
                                name="ta_reminder_at"
                                control={form.control}
                                render={({ field }) => (
                                    <Input
                                        id="ta_reminder_at"
                                        type="date"
                                        {...field}
                                        value={field.value || ''}
                                        className="h-8"
                                    />
                                )}
                            />
                        </Field>
                    </div>
                </div>
            </div>
        </div>
    );

    // Step 4: Group Config
    const GroupConfigStep = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Users className="h-4 w-4" />
                <span>Configure group size limits and supervision load</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
                <Field>
                    <FieldLabel htmlFor="min_group_size">Min Group Size</FieldLabel>
                    <Controller
                        name="min_group_size"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Input
                                id="min_group_size"
                                type="number"
                                min={1}
                                max={10}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                data-invalid={fieldState.error ? '' : undefined}
                                aria-invalid={fieldState.error ? 'true' : 'false'}
                            />
                        )}
                    />
                    <FieldError>{form.formState.errors.min_group_size?.message}</FieldError>
                </Field>
                
                <Field>
                    <FieldLabel htmlFor="max_group_size">Max Group Size</FieldLabel>
                    <Controller
                        name="max_group_size"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Input
                                id="max_group_size"
                                type="number"
                                min={1}
                                max={10}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                data-invalid={fieldState.error ? '' : undefined}
                                aria-invalid={fieldState.error ? 'true' : 'false'}
                            />
                        )}
                    />
                    <FieldError>{form.formState.errors.max_group_size?.message}</FieldError>
                </Field>
                
                <Field>
                    <FieldLabel htmlFor="max_supervisor_load">Max Supervisor Load</FieldLabel>
                    <Controller
                        name="max_supervisor_load"
                        control={form.control}
                        render={({ field, fieldState }) => (
                            <Input
                                id="max_supervisor_load"
                                type="number"
                                min={1}
                                max={50}
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                data-invalid={fieldState.error ? '' : undefined}
                                aria-invalid={fieldState.error ? 'true' : 'false'}
                            />
                        )}
                    />
                    <FieldError>{form.formState.errors.max_supervisor_load?.message}</FieldError>
                </Field>
            </div>
            <p className="text-xs text-muted-foreground">
                Max supervise load is the maximum number of groups a lecturer can supervise in this period.
            </p>
        </div>
    );

    // Step 5: Review
    const ReviewStep = () => (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <CheckCircle className="h-4 w-4" />
                <span>Review your configuration before saving</span>
            </div>
            <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Period Name</span>
                    <span className="font-medium">{formValues.name || '—'}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-medium">
                        {formValues.start_date || '—'} to {formValues.end_date || '—'}
                    </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Active Status</span>
                    <span className="font-medium">{formValues.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Bidding Window</span>
                    <span className="font-medium">
                        {formValues.bidding_start || '—'} to {formValues.bidding_end || '—'}
                    </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Group Size</span>
                    <span className="font-medium">{formValues.min_group_size} - {formValues.max_group_size} members</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Max Supervisor Load</span>
                    <span className="font-medium">{formValues.max_supervisor_load} groups/lecturer</span>
                </div>
                <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Evaluation Setup</span>
                    <span className={`font-medium ${evaluationSetup?.hasTemplates ? 'text-green-600' : 'text-yellow-600'}`}>
                        {evaluationSetup?.hasTemplates ? '✓ Ready' : '⚠ Required'}
                    </span>
                </div>
            </div>
        </div>
    );

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 0:
                return BasicInfoStep();
            case 1:
                return EvaluationSetupStep();
            case 2:
                return PhaseDatesStep();
            case 3:
                return GroupConfigStep();
            case 4:
                return ReviewStep();
            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editingPeriod ? 'Edit Period' : 'New Academic Period'}</DialogTitle>
                    <DialogDescription>
                        {editingPeriod 
                            ? 'Update period configuration in steps.' 
                            : 'Create a new period with step-by-step configuration.'
                        }
                    </DialogDescription>
                </DialogHeader>

                <Stepper 
                    steps={steps} 
                    currentStep={currentStep} 
                    className="mb-6"
                />

                <form onSubmit={form.handleSubmit(handleSubmit)}>
                    <StepperContent>
                        {renderCurrentStep()}
                    </StepperContent>

                    <StepperActions>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={currentStep === 0 ? () => onOpenChange(false) : handleBack}
                            disabled={submitting}
                        >
                            {currentStep === 0 ? 'Cancel' : 'Back'}
                        </Button>
                        
                        {currentStep === steps.length - 1 ? (
                            <Button 
                                type="submit"
                                disabled={submitting || !evaluationSetup?.hasTemplates}
                            >
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {editingPeriod ? 'Save Changes' : 'Create Period'}
                            </Button>
                        ) : (
                            <Button 
                                type="button"
                                onClick={handleNext}
                                disabled={currentStep === 1 && !evaluationSetup?.hasTemplates}
                            >
                                Next
                            </Button>
                        )}
                    </StepperActions>
                </form>
            </DialogContent>
        </Dialog>
    );
}
