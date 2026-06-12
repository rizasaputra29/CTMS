'use client';

import { useFormContext, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Info, Users, UserCheck } from 'lucide-react';
import type { PeriodFormData } from '@/lib/validations/period';

export function GroupConfigStep() {
    const { control, formState: { errors } } = useFormContext<PeriodFormData>();

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            {/* Section Header */}
            <div className="flex items-start gap-3 pb-4 border-b">
                <div className="p-2 bg-blue-50 rounded-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Konfigurasi Group</h3>
                    <p className="text-sm text-gray-500">Atur batasan jumlah anggota group dan beban dosen</p>
                </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-6">
                {/* Group Size */}
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="min_group_size" className="text-sm font-medium text-gray-700">
                            Minimal Jumlah Anggota <span className="text-red-500">*</span>
                        </Label>
                        <Controller
                            name="min_group_size"
                            control={control}
                            render={({ field }) => (
                                <Input
                                    id="min_group_size"
                                    type="number"
                                    min={1}
                                    max={10}
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                    className={`h-11 ${errors.min_group_size ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
                                />
                            )}
                        />
                        {errors.min_group_size && (
                            <p className="text-sm text-red-600 flex items-center gap-1">
                                <Info className="h-3.5 w-3.5" />
                                {errors.min_group_size.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="max_group_size" className="text-sm font-medium text-gray-700">
                            Maximal Jumlah Anggota <span className="text-red-500">*</span>
                        </Label>
                        <Controller
                            name="max_group_size"
                            control={control}
                            render={({ field }) => (
                                <Input
                                    id="max_group_size"
                                    type="number"
                                    min={1}
                                    max={10}
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                    className={`h-11 ${errors.max_group_size ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
                                />
                            )}
                        />
                        {errors.max_group_size && (
                            <p className="text-sm text-red-600 flex items-center gap-1">
                                <Info className="h-3.5 w-3.5" />
                                {errors.max_group_size.message}
                            </p>
                        )}
                    </div>
                </div>

                {/* Max Supervisor Load */}
                <div className="space-y-2">
                    <Label htmlFor="max_supervisor_load" className="text-sm font-medium text-gray-700">
                        Maximal Dosen Pembimbing <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                        <Controller
                            name="max_supervisor_load"
                            control={control}
                            render={({ field }) => (
                                <Input
                                    id="max_supervisor_load"
                                    type="number"
                                    min={1}
                                    max={50}
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                    className={`h-11 ${errors.max_supervisor_load ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}`}
                                />
                            )}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                            group/dosen
                        </div>
                    </div>
                    {errors.max_supervisor_load && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                            <Info className="h-3.5 w-3.5" />
                            {errors.max_supervisor_load.message}
                        </p>
                    )}
                </div>

                {/* Description */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <UserCheck className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-amber-900">
                                Informasi Beban Dosen
                            </p>
                            <p className="text-sm text-amber-700">
                                Maximal Dosen Pembimbing menentukan jumlah maksimal group yang dapat 
                                dibimbing oleh satu dosen dalam periode ini. Ini membantu menjaga 
                                keseimbangan beban mengajar dan memastikan kualitas bimbingan yang optimal.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
