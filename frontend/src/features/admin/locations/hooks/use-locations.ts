"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  locationSchema,
  type LocationFormData,
} from "@/lib/validations/location";
import type { Location } from "@/features/admin/locations/types";

const QUERY_KEY = ["admin", "locations"] as const;

export function useLocations() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Location | null>(null);

  const { data: locations = [], isLoading: loading } = useQuery<Location[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await api.get("/locations/all");
      return res.data?.data || [];
    },
  });

  const form = useForm<LocationFormData>({
    resolver: zodResolver(locationSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      type: "offline",
      capacity: "",
      description: "",
      is_active: true,
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: LocationFormData) => {
      const payload = {
        name: data.name,
        type: data.type,
        capacity: data.capacity ? parseInt(data.capacity) : null,
        description: data.description || null,
        is_active: data.is_active,
      };

      if (editing) {
        await api.put(`/locations/${editing.id}`, payload);
      } else {
        await api.post("/locations", payload);
      }
    },
    onSuccess: () => {
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/locations/${id}`);
    },
    onSuccess: () => {
      setConfirmTarget(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onSettled: () => {
      setDeleting(null);
    },
  });

  const resetForm = useCallback(() => {
    setEditing(null);
    form.reset({
      name: "",
      type: "offline",
      capacity: "",
      description: "",
      is_active: true,
    });
  }, [form]);

  const openCreate = useCallback(() => {
    resetForm();
    setDialogOpen(true);
  }, [resetForm]);

  const openEdit = useCallback(
    (location: Location) => {
      setEditing(location);
      form.reset({
        name: location.name,
        type: location.type,
        capacity: location.capacity?.toString() || "",
        description: location.description || "",
        is_active: location.is_active,
      });
      setDialogOpen(true);
    },
    [form]
  );

  const onSubmit = useCallback(
    async (data: LocationFormData) => {
      await toast.promise(saveMutation.mutateAsync(data), {
        loading: editing ? "Memperbarui lokasi..." : "Menyimpan lokasi...",
        success: editing
          ? "Lokasi berhasil diperbarui"
          : "Lokasi berhasil dibuat",
        error: (error) =>
          api.getApiErrorMessage(error, "Gagal menyimpan lokasi"),
      });
    },
    [saveMutation, editing]
  );

  const requestDelete = useCallback((location: Location) => {
    setConfirmTarget(location);
    setConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!confirmTarget) return;
    setDeleting(confirmTarget.id);
    setConfirmOpen(false);
    toast.promise(deleteMutation.mutateAsync(confirmTarget.id), {
      loading: "Menghapus lokasi...",
      success: "Lokasi berhasil dihapus",
      error: (error) => api.getApiErrorMessage(error, "Gagal menghapus lokasi"),
    });
  }, [confirmTarget, deleteMutation]);

  return {
    locations,
    loading,
    dialogOpen,
    setDialogOpen,
    editing,
    deleting,
    form,
    openCreate,
    openEdit,
    onSubmit,
    requestDelete,
    confirmOpen,
    setConfirmOpen,
    confirmTarget,
    confirmDelete,
  };
}
