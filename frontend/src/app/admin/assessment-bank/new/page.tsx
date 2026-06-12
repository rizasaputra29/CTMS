'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TemplateForm } from '@/app/admin/assessment-bank/components/TemplateForm';
import api from '@/lib/api';
import { toast } from 'sonner';
import type { AssessmentBankTemplateFormData } from '@/lib/validations/assessment';

export default function NewTemplatePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: AssessmentBankTemplateFormData) => {
    setIsSubmitting(true);
    try {
      await api.post('/admin/assessment-templates', {
        code: data.code,
        name: data.code, // name is set to code as per existing pattern
        description: data.description,
        weight: data.weight,
        is_active: data.is_active,
      });
      toast.success('Komponen penilaian berhasil dibuat');
      router.push('/admin/assessment-bank');
    } catch (error: any) {
      console.error('Failed to create template:', error);
      const message = error.response?.data?.message || 'Gagal membuat komponen penilaian';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TemplateForm
      mode="create"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    />
  );
}
