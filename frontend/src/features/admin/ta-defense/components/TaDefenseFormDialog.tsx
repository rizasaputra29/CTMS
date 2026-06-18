'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import { taDefenseSchema, type TaDefenseFormData } from '@/lib/validations/ta-defense';
import type { Period, Dosen, Location, TaDefenseSchedule, EligibleStudentData } from '../types';

interface TaDefenseFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: 'create' | 'edit';
    editingSchedule: TaDefenseSchedule | null;
    periods: Period[];
    dosens: Dosen[];
    locations: Location[];
    eligibleGroups: EligibleStudentData[];
    fetchEligibleGroups: (periodId: string) => void;
    onCreate: (data: TaDefenseFormData) => Promise<void>;
    onUpdate: (id: number, data: TaDefenseFormData, periodId: number) => Promise<void>;
    isSubmitting: boolean;
}

export function TaDefenseFormDialog({
    open,
    onOpenChange,
    mode,
    editingSchedule,
    periods,
    dosens,
    locations,
    eligibleGroups,
    fetchEligibleGroups,
    onCreate,
    onUpdate,
    isSubmitting,
}: TaDefenseFormDialogProps) {
    const [examinerError, setExaminerError] = useState('');

    const form = useForm<TaDefenseFormData>({
        resolver: zodResolver(taDefenseSchema),
        mode: 'onBlur',
        defaultValues: {
            period_id: '',
            group_id: '',
            student_ids: [],
            date: '',
            start_time: '',
            end_time: '',
            location_id: '',
            examiner_1_id: '',
            examiner_2_id: '',
            notes: '',
        },
    });

    const watchedGroupId = form.watch('group_id');
    const watchedStudentIds = form.watch('student_ids');
    const watchedPeriodId = form.watch('period_id');
    const watchedExaminer1 = form.watch('examiner_1_id');
    const watchedExaminer2 = form.watch('examiner_2_id');

    useEffect(() => {
        if (!open) {
            resetForm();
            return;
        }

        if (mode === 'edit' && editingSchedule) {
            const formattedDate = editingSchedule.date ? editingSchedule.date.split('T')[0] : '';
            const formattedStartTime = editingSchedule.start_time ? editingSchedule.start_time.substring(0, 5) : '';
            const formattedEndTime = editingSchedule.end_time ? editingSchedule.end_time.substring(0, 5) : '';

            form.reset({
                period_id: editingSchedule.period?.id?.toString() || '',
                group_id: editingSchedule.group?.id?.toString() || '',
                student_ids: editingSchedule.students?.map(s => s.id.toString()) || [editingSchedule.student?.id.toString() || ''],
                date: formattedDate,
                start_time: formattedStartTime,
                end_time: formattedEndTime,
                location_id: editingSchedule.location_id?.toString() || '',
                examiner_1_id: editingSchedule.examiner1?.id?.toString() || '',
                examiner_2_id: editingSchedule.examiner2?.id?.toString() || '',
                notes: editingSchedule.notes || '',
            });

            if (editingSchedule.period?.id) {
                fetchEligibleGroups(editingSchedule.period.id.toString());
            }
        } else {
            resetForm();
        }
    }, [open, mode, editingSchedule]);

    const resetForm = () => {
        form.reset({
            period_id: '',
            group_id: '',
            student_ids: [],
            date: '',
            start_time: '',
            end_time: '',
            location_id: '',
            examiner_1_id: '',
            examiner_2_id: '',
            notes: '',
        });
        setExaminerError('');
    };

    const getAvailableStudents = () => {
        const group = eligibleGroups.find(g => g.id.toString() === watchedGroupId);
        return group?.members || [];
    };

    const getSupervisorIds = () => {
        const group = eligibleGroups.find(g => g.id.toString() === watchedGroupId);
        if (!group) return [];
        return group.supervisors?.map(s => s.id) || [];
    };

    const validateExaminers = () => {
        setExaminerError('');
        if (watchedExaminer1 === watchedExaminer2) {
            setExaminerError('Examiner 1 and Examiner 2 cannot be the same');
            return false;
        }
        const supervisorIds = getSupervisorIds();
        if (supervisorIds.includes(parseInt(watchedExaminer1))) {
            setExaminerError('Examiner 1 cannot be a supervisor of this group');
            return false;
        }
        if (supervisorIds.includes(parseInt(watchedExaminer2))) {
            setExaminerError('Examiner 2 cannot be a supervisor of this group');
            return false;
        }
        return true;
    };

    const handleClose = () => {
        onOpenChange(false);
        resetForm();
    };

    const onSubmit = async (data: TaDefenseFormData) => {
        if (!validateExaminers()) return;

        try {
            if (mode === 'edit' && editingSchedule) {
                await onUpdate(editingSchedule.id, data, editingSchedule.period.id);
                handleClose();
            } else {
                await onCreate(data);
                handleClose();
            }
        } catch (error: unknown) {
            const message = axios.isAxiosError(error)
                ? (error.response?.data?.message as string) || 'Failed to save schedule'
                : 'Failed to save schedule';
            if (message.includes('supervisor')) setExaminerError(message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-150">
                <DialogHeader>
                    <DialogTitle>Schedule TA Defense</DialogTitle>
                    <DialogDescription>
                        Create a new TA defense schedule for selected students.
                        Examiners cannot be supervisors of the group.
                    </DialogDescription>
                </DialogHeader>

                {examinerError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{examinerError}</AlertDescription>
                    </Alert>
                )}

                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <div className="grid gap-4 py-4">
                        {mode === 'create' && (
                            <Controller
                                name="period_id"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field>
                                        <FieldLabel>Period</FieldLabel>
                                        <Select
                                            value={field.value}
                                            onValueChange={(val) => {
                                                field.onChange(val);
                                                form.setValue('group_id', '');
                                                form.setValue('student_ids', []);
                                                fetchEligibleGroups(val);
                                            }}
                                        >
                                            <SelectTrigger className={fieldState.error ? 'border-destructive' : ''}>
                                                <SelectValue placeholder="Select period" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {periods.map(p => (
                                                    <SelectItem key={p.id} value={p.id.toString()}>
                                                        {p.name}
                                                        {p.is_active && <span className="ml-2 text-[11px] text-muted-foreground/60">(active)</span>}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                                    </Field>
                                )}
                            />
                        )}

                        <Controller
                            name="group_id"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field>
                                    <FieldLabel>Group</FieldLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={(val) => {
                                            field.onChange(val);
                                            form.setValue('student_ids', []);
                                        }}
                                        disabled={!watchedPeriodId}
                                    >
                                        <SelectTrigger className={fieldState.error ? 'border-destructive' : ''}>
                                            <SelectValue placeholder={watchedPeriodId ? 'Select group' : 'Select period first'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {eligibleGroups.map(g => (
                                                <SelectItem key={g.id} value={g.id.toString()}>
                                                    Group {g.id} {g.code && `(${g.code})`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                                </Field>
                            )}
                        />

                        {watchedGroupId && (
                            <Field>
                                <FieldLabel>Students <span className="text-muted-foreground text-xs">(select at least one)</span></FieldLabel>
                                <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                                    {getAvailableStudents().length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No students in this group.</p>
                                    ) : (
                                        getAvailableStudents().map((m) => {
                                            const isAlreadySelected = m.is_already_selected;
                                            const isReadyForSidang = m.is_ready_for_sidang;
                                            const isChecked = watchedStudentIds.includes(m.student.id.toString());

                                            return (
                                                <div key={m.student.id} className="flex items-center space-x-3">
                                                    <Checkbox
                                                        id={`student-${m.student.id}`}
                                                        checked={isChecked || isAlreadySelected}
                                                        disabled={isAlreadySelected || !isReadyForSidang}
                                                        onCheckedChange={(checked) => {
                                                            if (isAlreadySelected) {
                                                                toast.error('Already selected students cannot be removed');
                                                                return;
                                                            }
                                                            const currentIds = form.getValues('student_ids');
                                                            if (checked) {
                                                                form.setValue('student_ids', [...currentIds, m.student.id.toString()]);
                                                            } else {
                                                                form.setValue('student_ids', currentIds.filter(id => id !== m.student.id.toString()));
                                                            }
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor={`student-${m.student.id}`}
                                                        className={`text-sm flex items-center gap-2 cursor-pointer ${!isReadyForSidang && !isAlreadySelected ? 'text-muted-foreground' : ''}`}
                                                    >
                                                        <span>{m.student.name}</span>
                                                        <span className="text-xs text-muted-foreground font-mono">{m.student.nim}</span>
                                                        {m.is_leader && <span className="text-[10px] h-4 px-1.5 bg-secondary text-secondary-foreground rounded">Leader</span>}
                                                        {isAlreadySelected && <span className="text-[10px] h-4 px-1.5 bg-primary text-primary-foreground rounded">Selected</span>}
                                                        {!isReadyForSidang && !isAlreadySelected && (
                                                            <>
                                                                <Lock className="h-3 w-3 text-muted-foreground" />
                                                                <span className="text-[10px] h-4 px-1.5 border rounded text-muted-foreground" title="Not ready for sidang TA">Locked</span>
                                                            </>
                                                        )}
                                                    </label>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                                {form.formState.errors.student_ids && (
                                    <FieldError>{form.formState.errors.student_ids.message}</FieldError>
                                )}
                                {watchedStudentIds.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        {watchedStudentIds.length} student{watchedStudentIds.length > 1 ? 's' : ''} selected
                                    </p>
                                )}
                            </Field>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <Controller
                                name="date"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field>
                                        <FieldLabel>Date</FieldLabel>
                                        <Input
                                            type="date"
                                            value={field.value}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            className={fieldState.error ? 'border-destructive' : ''}
                                        />
                                        {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="location_id"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field>
                                        <FieldLabel>Location <span className="text-destructive">*</span></FieldLabel>
                                        <Select value={field.value ?? ''} onValueChange={field.onChange}>
                                            <SelectTrigger className={fieldState.error ? 'border-destructive' : ''}>
                                                <SelectValue placeholder="Select location..." />
                                            </SelectTrigger>
                                            <SelectContent position="popper" avoidCollisions>
                                                {locations.length === 0 && (
                                                    <SelectItem value="no-locations" disabled>No locations available</SelectItem>
                                                )}
                                                {locations.filter(l => l.is_active).map((loc) => (
                                                    <SelectItem key={loc.id} value={loc.id.toString()}>
                                                        {loc.name} {loc.capacity ? `(Cap: ${loc.capacity})` : ''}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                                    </Field>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Controller
                                name="start_time"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field>
                                        <FieldLabel>Start Time</FieldLabel>
                                        <Input
                                            type="time"
                                            value={field.value}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            className={fieldState.error ? 'border-destructive' : ''}
                                        />
                                        {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="end_time"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field>
                                        <FieldLabel>End Time</FieldLabel>
                                        <Input
                                            type="time"
                                            value={field.value}
                                            onChange={field.onChange}
                                            onBlur={field.onBlur}
                                            className={fieldState.error ? 'border-destructive' : ''}
                                        />
                                        {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                                    </Field>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Controller
                                name="examiner_1_id"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field>
                                        <FieldLabel>Examiner 1</FieldLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger className={fieldState.error ? 'border-destructive' : ''}>
                                                <SelectValue placeholder="Select examiner" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {dosens.map(d => (
                                                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                                    </Field>
                                )}
                            />
                            <Controller
                                name="examiner_2_id"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field>
                                        <FieldLabel>Examiner 2</FieldLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger className={fieldState.error ? 'border-destructive' : ''}>
                                                <SelectValue placeholder="Select examiner" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {dosens.map(d => (
                                                    <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                                    </Field>
                                )}
                            />
                        </div>

                        <Controller
                            name="notes"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field>
                                    <FieldLabel>Notes (Optional)</FieldLabel>
                                    <Input
                                        placeholder="Additional notes..."
                                        value={field.value}
                                        onChange={field.onChange}
                                        onBlur={field.onBlur}
                                        className={fieldState.error ? 'border-destructive' : ''}
                                    />
                                    {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
                                </Field>
                            )}
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || watchedStudentIds.length === 0 || (mode === 'create' && !watchedPeriodId)}
                        >
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {mode === 'create' ? 'Create Schedule' : 'Update Schedule'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
