'use client';

import { useFormContext, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar, Info } from 'lucide-react';
import type { PeriodFormData } from '@/lib/validations/period';

export function BasicInfoStep() {
    const { control, formState: { errors } } = useFormContext<PeriodFormData>();

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            {/* Section Header */}
            <div className="flex items-start gap-3 pb-4 border-b">
                <div className="p-2 bg-blue-50 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Informasi Dasar Periode</h3>
                    <p className="text-sm text-gray-500">Masukkan informasi dasar untuk periode akademik baru</p>
                </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-6">
                {/* Period Name */}
                <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                        Nama Periode <span className="text-red-500">*</span>
                    </Label>
                    <Controller
                        name="name"
                        control={control}
                        render={({ field }) => (
                            <Input
                                id="name"
                                placeholder="Contoh: Semester Ganjil 2025/2026"
                                {...field}
                                className={`h-11 ${errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
                            />
                        )}
                    />
                    {errors.name && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                            <Info className="h-3.5 w-3.5" />
                            {errors.name.message}
                        </p>
                    )}
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="start_date" className="text-sm font-medium text-gray-700">
                            Start Date <span className="text-red-500">*</span>
                        </Label>
                        <Controller
                            name="start_date"
                            control={control}
                            render={({ field }) => (
                                <Input
                                    id="start_date"
                                    type="date"
                                    {...field}
                                    className={`h-11 ${errors.start_date ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
                                />
                            )}
                        />
                        {errors.start_date && (
                            <p className="text-sm text-red-600 flex items-center gap-1">
                                <Info className="h-3.5 w-3.5" />
                                {errors.start_date.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="end_date" className="text-sm font-medium text-gray-700">
                            End Date <span className="text-red-500">*</span>
                        </Label>
                        <Controller
                            name="end_date"
                            control={control}
                            render={({ field }) => (
                                <Input
                                    id="end_date"
                                    type="date"
                                    {...field}
                                    className={`h-11 ${errors.end_date ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
                                />
                            )}
                        />
                        {errors.end_date && (
                            <p className="text-sm text-red-600 flex items-center gap-1">
                                <Info className="h-3.5 w-3.5" />
                                {errors.end_date.message}
                            </p>
                        )}
                    </div>
                </div>

                {/* Active Status Toggle */}
                <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                                Set Aktif <span className="text-red-500">*</span>
                            </Label>
                            <p className="text-xs text-gray-500">
                                Periode yang aktif akan digunakan untuk proses akademik saat ini
                            </p>
                        </div>
                        <Controller
                            name="is_active"
                            control={control}
                            render={({ field }) => (
                                <Switch
                                    id="is_active"
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    className="data-[state=checked]:bg-blue-600"
                                />
                            )}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
