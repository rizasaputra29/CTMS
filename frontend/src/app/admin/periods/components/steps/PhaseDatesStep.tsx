'use client';

import { useFormContext, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarDays } from 'lucide-react';
import type { PeriodFormData } from '@/lib/validations/period';

const phases = [
    {
        id: 'bidding',
        title: 'Bidding',
        description: 'Periode pemilihan topik dan dosen pembimbing',
        fields: ['bidding_start', 'bidding_end', 'bidding_reminder_at'],
    },
    {
        id: 'pdc1',
        title: 'PDC1',
        description: 'Progress Defense Check 1',
        fields: ['pdc1_start', 'pdc1_end', 'pdc1_reminder_at'],
    },
    {
        id: 'pdc2',
        title: 'PDC2',
        description: 'Progress Defense Check 2',
        fields: ['pdc2_start', 'pdc2_end', 'pdc2_reminder_at'],
    },
    {
        id: 'expo',
        title: 'EXPO TA',
        description: 'Pameran dan presentasi tugas akhir',
        fields: ['expo_date', 'expo_reminder_at'],
    },
    {
        id: 'sidang',
        title: 'Sidang TA',
        description: 'Sidang akhir tugas akhir',
        fields: ['ta_start', 'ta_end', 'ta_reminder_at'],
    },
];

export function PhaseDatesStep() {
    const { control } = useFormContext<PeriodFormData>();

    const getFieldLabel = (fieldName: string) => {
        if (fieldName.includes('start')) return 'Tanggal Mulai';
        if (fieldName.includes('end')) return 'Tanggal Berakhir';
        if (fieldName.includes('reminder')) return 'Tanggal Pengingat';
        if (fieldName.includes('date') && !fieldName.includes('start') && !fieldName.includes('end')) return 'Tanggal';
        return 'Tanggal';
    };

    const isRequired = (fieldName: string) => {
        return fieldName.includes('start') || fieldName.includes('end') || fieldName.includes('date');
    };

    return (
        <div className="space-y-8">
            {/* Section Header */}
            <div className="flex items-start gap-3 pb-4 border-b">
                <div className="p-2 bg-blue-50 rounded-lg">
                    <CalendarDays className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Tanggal Fase Periode</h3>
                    <p className="text-sm text-gray-500">Atur jadwal untuk setiap fase dalam periode akademik</p>
                </div>
            </div>

            {/* Phase Cards */}
            <div className="grid gap-6">
                {phases.map((phase) => (
                    <div
                        key={phase.id}
                        className="bg-gray-50 rounded-xl p-6 space-y-4"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h4 className="font-semibold text-gray-900">
                                    {phase.title}
                                </h4>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {phase.description}
                                </p>
                            </div>
                        </div>

                        <div
                            className={`grid gap-4 ${
                                phase.fields.length === 2
                                    ? 'grid-cols-2'
                                    : 'grid-cols-1 md:grid-cols-3'
                            }`}
                        >
                            {phase.fields.map((fieldName) => (
                                <div key={fieldName} className="space-y-2">
                                    <Label
                                        htmlFor={fieldName}
                                        className="text-sm font-medium text-gray-700"
                                    >
                                        {getFieldLabel(fieldName)}
                                        {isRequired(fieldName) && (
                                            <span className="text-red-500 ml-1">*</span>
                                        )}
                                    </Label>
                                    <Controller
                                        name={fieldName as keyof PeriodFormData}
                                        control={control}
                                        render={({ field }) => (
                                            <Input
                                                id={fieldName}
                                                type="date"
                                                name={field.name}
                                                onChange={field.onChange}
                                                onBlur={field.onBlur}
                                                ref={field.ref}
                                                value={typeof field.value === 'string' ? field.value : ''}
                                                className="h-11 bg-white"
                                            />
                                        )}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
