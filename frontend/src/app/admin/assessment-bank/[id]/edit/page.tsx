'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { TemplateForm } from '../../components/TemplateForm';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { AssessmentBankTemplateFormData } from '@/lib/validations/assessment';

interface Template {
  id: number;
  code: string;
  name: string;
  description: string | null;
  weight: number;
  is_active: boolean;
}

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params?.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);

  const fetchTemplate = useCallback(async () => {
    if (!templateId) return;

    try {
      const res = await api.get(`/admin/assessment-templates/${templateId}`);
      const data = res.data?.data || res.data;

      if (data) {
        setTemplate(data);
      }
    } catch (error: any) {
      console.error('Failed to fetch template:', error);
      toast.error('Gagal memuat data komponen');
      router.push('/admin/assessment-bank');
    } finally {
      setIsLoading(false);
    }
  }, [templateId, router]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  const handleSubmit = async (data: AssessmentBankTemplateFormData) => {
    if (!templateId) return;

    setIsSubmitting(true);
    try {
      await api.put(`/admin/assessment-templates/${templateId}`, {
        code: data.code,
        name: data.code, // name is set to code as per existing pattern
        description: data.description,
        weight: data.weight,
        is_active: data.is_active,
      });
      toast.success('Komponen penilaian berhasil diperbarui');
      router.push('/admin/assessment-bank');
    } catch (error: any) {
      console.error('Failed to update template:', error);
      const message = error.response?.data?.message || 'Gagal memperbarui komponen penilaian';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-gray-600">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return null;
  }

  return (
    <TemplateForm
      mode="edit"
      template={template}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    />
  );
}
