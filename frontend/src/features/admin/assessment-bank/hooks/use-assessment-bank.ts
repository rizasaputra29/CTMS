"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import type { AssessmentBankTemplateFormData } from "@/lib/validations/assessment";
import type { AssessmentTemplate } from "@/features/admin/assessment-bank/types";

const QUERY_KEY = ["admin", "assessment-templates"] as const;

export function useAssessmentBank() {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<AssessmentTemplate | null>(
    null
  );

  const { data: templates = [], isLoading: loading } = useQuery<
    AssessmentTemplate[]
  >({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await api.get("/admin/assessment-templates");
      return res.data?.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AssessmentBankTemplateFormData) => {
      await api.post("/admin/assessment-templates", {
        code: data.code,
        name: data.name || data.code,
        description: data.description,
        weight: data.weight,
        is_active: data.is_active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: AssessmentBankTemplateFormData;
    }) => {
      await api.put(`/admin/assessment-templates/${id}`, {
        code: data.code,
        name: data.name || data.code,
        description: data.description,
        weight: data.weight,
        is_active: data.is_active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/assessment-templates/${id}`);
    },
    onSuccess: () => {
      setConfirmTarget(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onSettled: () => {
      setDeleting(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (template: AssessmentTemplate) => {
      await api.put(`/admin/assessment-templates/${template.id}`, {
        is_active: !template.is_active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const bulkToggleMutation = useMutation({
    mutationFn: async ({
      ids,
      is_active,
    }: {
      ids: number[];
      is_active: boolean;
    }) => {
      await Promise.all(
        ids.map((id) =>
          api.put(`/admin/assessment-templates/${id}`, { is_active })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(
        ids.map((id) => api.delete(`/admin/assessment-templates/${id}`))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const createTemplate = useCallback(
    async (data: AssessmentBankTemplateFormData) => {
      await toast.promise(createMutation.mutateAsync(data), {
        loading: "Menyimpan komponen...",
        success: "Komponen penilaian berhasil dibuat",
        error: (error) =>
          api.getApiErrorMessage(error, "Gagal membuat komponen penilaian"),
      });
    },
    [createMutation]
  );

  const updateTemplate = useCallback(
    async (id: number, data: AssessmentBankTemplateFormData) => {
      await toast.promise(updateMutation.mutateAsync({ id, data }), {
        loading: "Memperbarui komponen...",
        success: "Komponen penilaian berhasil diperbarui",
        error: (error) =>
          api.getApiErrorMessage(error, "Gagal memperbarui komponen penilaian"),
      });
    },
    [updateMutation]
  );

  const toggleTemplate = useCallback(
    async (template: AssessmentTemplate) => {
      await toast.promise(toggleMutation.mutateAsync(template), {
        loading: template.is_active
          ? "Menonaktifkan komponen..."
          : "Mengaktifkan komponen...",
        success: template.is_active
          ? "Komponen dinonaktifkan"
          : "Komponen diaktifkan",
        error: (error) =>
          api.getApiErrorMessage(error, "Gagal mengubah status komponen"),
      });
    },
    [toggleMutation]
  );

  const requestDelete = useCallback((template: AssessmentTemplate) => {
    setConfirmTarget(template);
    setConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!confirmTarget) return;
    setDeleting(confirmTarget.id);
    setConfirmOpen(false);
    toast.promise(deleteMutation.mutateAsync(confirmTarget.id), {
      loading: "Menghapus komponen...",
      success: "Komponen berhasil dihapus",
      error: (error) =>
        api.getApiErrorMessage(error, "Gagal menghapus komponen"),
    });
  }, [confirmTarget, deleteMutation]);

  const bulkActivate = useCallback(
    async (ids: number[]) => {
      await toast.promise(
        bulkToggleMutation.mutateAsync({ ids, is_active: true }),
        {
          loading: "Mengaktifkan komponen...",
          success: `${ids.length} komponen diaktifkan`,
          error: (error) =>
            api.getApiErrorMessage(error, "Gagal mengaktifkan komponen"),
        }
      );
    },
    [bulkToggleMutation]
  );

  const bulkDeactivate = useCallback(
    async (ids: number[]) => {
      await toast.promise(
        bulkToggleMutation.mutateAsync({ ids, is_active: false }),
        {
          loading: "Menonaktifkan komponen...",
          success: `${ids.length} komponen dinonaktifkan`,
          error: (error) =>
            api.getApiErrorMessage(error, "Gagal menonaktifkan komponen"),
        }
      );
    },
    [bulkToggleMutation]
  );

  const bulkDelete = useCallback(
    async (ids: number[]) => {
      await toast.promise(bulkDeleteMutation.mutateAsync(ids), {
        loading: "Menghapus komponen...",
        success: `${ids.length} komponen dihapus`,
        error: (error) =>
          api.getApiErrorMessage(error, "Gagal menghapus komponen"),
      });
    },
    [bulkDeleteMutation]
  );

  return {
    templates,
    loading,
    deleting,
    requestDelete,
    confirmDelete,
    confirmOpen,
    setConfirmOpen,
    confirmTarget,
    createTemplate,
    updateTemplate,
    toggleTemplate,
    bulkActivate,
    bulkDeactivate,
    bulkDelete,
  };
}
