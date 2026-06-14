"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { usePeriods } from "@/features/admin/periods/hooks/use-periods";
import { PeriodTable } from "@/features/admin/periods/components/PeriodTable";
import type { Period } from "@/features/admin/periods/types";

export function PeriodsFeature() {
  const router = useRouter();
  const {
    periods,
    loading,
    deleting,
    requestDelete,
    confirmOpen,
    setConfirmOpen,
    confirmTarget,
    confirmDelete,
    toggleActive,
  } = usePeriods();

  const handleEdit = (period: Period) => {
    router.push(`/admin/periods/${period.id}/edit`);
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Periode Capstone & TA
            </h1>
          </div>
          <Button
            onClick={() => router.push("/admin/periods/new")}
            className="cursor-pointer gap-2"
          >
            <Plus className="h-4 w-4" />
            Periode Baru
          </Button>
        </div>

        <PeriodTable
          periods={periods}
          loading={loading}
          onEdit={handleEdit}
          onDelete={requestDelete}
          onToggleActive={toggleActive}
          deleting={deleting}
        />

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Hapus Periode"
          description={`Apakah Anda yakin ingin menghapus "${confirmTarget?.name}"? Tindakan ini tidak dapat dibatalkan.`}
          confirmLabel="Hapus"
          cancelLabel="Batal"
          variant="destructive"
          onConfirm={confirmDelete}
        />
      </div>
    </div>
  );
}
