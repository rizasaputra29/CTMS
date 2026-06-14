"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useLocations } from "@/features/admin/locations/hooks/use-locations";
import { LocationTable } from "@/features/admin/locations/components/LocationTable";
import { LocationFormDialog } from "@/features/admin/locations/components/LocationFormDialog";

export function LocationsFeature() {
  const {
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
  } = useLocations();

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Locations</h1>
          </div>
          <Button onClick={openCreate} className="cursor-pointer gap-2">
            <Plus className="h-4 w-4" />
            Tambah Lokasi
          </Button>
        </div>

        <LocationTable
          locations={locations}
          loading={loading}
          onEdit={openEdit}
          onDelete={requestDelete}
          deleting={deleting}
        />

        <LocationFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
          form={form}
          onSubmit={onSubmit}
        />

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Hapus Lokasi"
          description={`Apakah Anda yakin ingin menghapus "${confirmTarget?.name}"? Lokasi harus dinonaktifkan sebelum dihapus.`}
          confirmLabel="Hapus"
          cancelLabel="Batal"
          variant="destructive"
          onConfirm={confirmDelete}
        />
      </div>
    </div>
  );
}
