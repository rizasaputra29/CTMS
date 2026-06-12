'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  assessmentBankTemplateSchema,
  type AssessmentBankTemplateFormData,
} from '@/lib/validations/assessment';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TemplateFormProps {
  mode: 'create' | 'edit';
  template?: {
    id: number;
    code: string;
    name: string;
    description: string | null;
    weight: number;
    is_active: boolean;
  } | null;
  onSubmit: (data: AssessmentBankTemplateFormData) => Promise<void>;
  isSubmitting: boolean;
}

export function TemplateForm({ mode, template, onSubmit, isSubmitting }: TemplateFormProps) {
  const router = useRouter();
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  const form = useForm<AssessmentBankTemplateFormData>({
    resolver: zodResolver(assessmentBankTemplateSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      weight: 0,
      is_active: true,
    },
  });

  const { register, handleSubmit, formState, watch, setValue, reset } = form;
  const { errors, isDirty } = formState;
  const descriptionValue = watch('description') || '';

  // Populate form in edit mode
  useEffect(() => {
    if (mode === 'edit' && template) {
      reset({
        code: template.code,
        name: template.name,
        description: template.description || '',
        weight: Number(template.weight),
        is_active: template.is_active,
      });
    }
  }, [mode, template, reset]);

  // Handle beforeunload for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleBack = () => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      router.push('/admin/assessment-bank');
    }
  };

  const confirmNavigation = () => {
    if (pendingNavigation) {
      router.push(pendingNavigation);
    } else {
      router.push('/admin/assessment-bank');
    }
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  };

  const cancelNavigation = () => {
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
  };

  const onFormSubmit = async (data: AssessmentBankTemplateFormData) => {
    await onSubmit(data);
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Unsaved Changes Dialog */}
      {showUnsavedDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Perubahan Belum Disimpan
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Anda memiliki perubahan yang belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelNavigation}>
                Batal
              </Button>
              <Button variant="destructive" onClick={confirmNavigation}>
                Tinggalkan Halaman
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className=" sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {mode === 'create' ? 'Tambah Komponen Penilaian' : 'Edit Komponen Penilaian'}
                </h1>
                <p className="text-sm text-gray-500">
                  {mode === 'create'
                    ? 'Buat komponen penilaian baru untuk digunakan dalam berbagai periode.'
                    : 'Ubah informasi komponen penilaian yang sudah ada.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                Kembali
              </Button>
              <Button
                onClick={handleSubmit(onFormSubmit)}
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Simpan'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Card className="shadow-sm">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg font-semibold text-gray-900">
              Informasi Penilaian
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="max-w-2xl space-y-6">
              {/* Kode */}
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <label className="text-sm font-medium text-gray-900">
                    Kode <span className="text-red-500">*</span>
                  </label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Kode unik untuk mengidentifikasi komponen penilaian</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  {...register('code')}
                  placeholder="Contoh: CPL-001"
                  className={errors.code ? 'border-red-500' : ''}
                />
                {errors.code && (
                  <p className="text-sm text-red-500">{errors.code.message}</p>
                )}
                <p className="text-xs text-gray-500">
                  Kode harus unik dan tidak boleh sama dengan komponen lain.
                </p>
              </div>

              {/* Deskripsi */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-medium text-gray-900">
                      Deskripsi <span className="text-red-500">*</span>
                    </label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-4 w-4 text-gray-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Penjelasan detail tentang komponen penilaian ini</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <span
                    className={`text-xs ${
                      descriptionValue.length > 200 ? 'text-red-500' : 'text-gray-400'
                    }`}
                  >
                    {descriptionValue.length}/200
                  </span>
                </div>
                <Textarea
                  {...register('description')}
                  placeholder="Masukkan deskripsi komponen penilaian..."
                  rows={4}
                  className={errors.description ? 'border-red-500' : ''}
                  maxLength={200}
                />
                {errors.description && (
                  <p className="text-sm text-red-500">{errors.description.message}</p>
                )}
              </div>

              {/* Bobot */}
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <label className="text-sm font-medium text-gray-900">
                    Bobot <span className="text-red-500">*</span>
                  </label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Persentase bobot penilaian (0-100)</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    {...register('weight', { valueAsNumber: true })}
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    placeholder="0"
                    className={`w-32 ${errors.weight ? 'border-red-500' : ''}`}
                  />
                  <span className="text-sm text-gray-500">%</span>
                  <Badge
                    variant="outline"
                    className="bg-indigo-50 text-indigo-700 border-indigo-200"
                  >
                    Total bobot harus 100% per fase
                  </Badge>
                </div>
                {errors.weight && (
                  <p className="text-sm text-red-500">{errors.weight.message}</p>
                )}
              </div>

              {/* Set Aktif */}
              <div className="space-y-3">
                <div className="flex items-center gap-1">
                  <label className="text-sm font-medium text-gray-900">
                    Set Aktif <span className="text-red-500">*</span>
                  </label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-gray-400" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tentukan apakah komponen ini aktif dan dapat digunakan</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={watch('is_active')}
                    onCheckedChange={(checked) => setValue('is_active', checked)}
                  />
                  <span className="text-sm text-gray-700">
                    {watch('is_active') ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Komponen nonaktif tidak akan ditampilkan saat konfigurasi penilaian.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
