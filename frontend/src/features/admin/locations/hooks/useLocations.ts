import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  locationSchema,
  type LocationFormData,
} from "@/lib/validations/location";
import type { Location } from "@/features/admin/locations/types";

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Location | null>(null);

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

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/locations/all");
      setLocations(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch locations", err);
      toast.error("Gagal memuat lokasi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

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
      try {
        const payload = {
          name: data.name,
          type: data.type,
          capacity: data.capacity ? parseInt(data.capacity) : null,
          description: data.description || null,
          is_active: data.is_active,
        };

        if (editing) {
          await api.put(`/locations/${editing.id}`, payload);
          toast.success("Lokasi berhasil diperbarui");
        } else {
          await api.post("/locations", payload);
          toast.success("Lokasi berhasil dibuat");
        }

        setDialogOpen(false);
        resetForm();
        fetchLocations();
      } catch (error) {
        console.error("Failed to save location", error);
        const message = api.getApiErrorMessage(error, "Gagal menyimpan lokasi");
        toast.error(message);
      }
    },
    [editing, resetForm, fetchLocations]
  );

  const requestDelete = useCallback((location: Location) => {
    setConfirmTarget(location);
    setConfirmOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!confirmTarget) return;

    setDeleting(confirmTarget.id);
    setConfirmOpen(false);
    try {
      await api.delete(`/locations/${confirmTarget.id}`);
      toast.success("Lokasi berhasil dihapus");
      setConfirmTarget(null);
      fetchLocations();
    } catch (error) {
      console.error("Failed to delete location", error);
      const message = api.getApiErrorMessage(error, "Gagal menghapus lokasi");
      toast.error(message);
    } finally {
      setDeleting(null);
    }
  }, [confirmTarget, fetchLocations]);

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
