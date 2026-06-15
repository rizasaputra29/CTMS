"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import type { Period } from "@/features/admin/periods/types";

const QUERY_KEY = ["admin", "periods"] as const;

export function usePeriods() {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Period | null>(null);

  const { data: periods = [], isLoading: loading } = useQuery<Period[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await api.get("/admin/periods");
      return res.data?.data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/periods/${id}`);
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
    mutationFn: async (period: Period) => {
      await api.put(`/admin/periods/${period.id}`, {
        is_active: !period.is_active,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const requestDelete = useCallback((period: Period) => {
    setConfirmTarget(period);
    setConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!confirmTarget) return;
    setDeleting(confirmTarget.id);
    setConfirmOpen(false);
    toast.promise(deleteMutation.mutateAsync(confirmTarget.id), {
      loading: "Menghapus periode...",
      success: "Periode berhasil dihapus",
      error: (error) =>
        api.getApiErrorMessage(error, "Gagal menghapus periode"),
    });
  }, [confirmTarget, deleteMutation]);

  const toggleActive = useCallback(
    (period: Period) => {
      toast.promise(toggleMutation.mutateAsync(period), {
        loading: period.is_active
          ? "Menonaktifkan periode..."
          : "Mengaktifkan periode...",
        success: period.is_active
          ? "Periode dinonaktifkan"
          : "Periode diaktifkan",
        error: "Gagal mengubah status periode",
      });
    },
    [toggleMutation]
  );

  return {
    periods,
    loading,
    deleting,
    requestDelete,
    confirmOpen,
    setConfirmOpen,
    confirmTarget,
    confirmDelete,
    toggleActive,
  };
}
