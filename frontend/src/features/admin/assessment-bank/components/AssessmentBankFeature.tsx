"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  AssessmentBankTable,
  useAssessmentBank,
  type AssessmentTemplate,
} from "@/features/admin/assessment-bank";

export function AssessmentBankFeature() {
  const router = useRouter();
  const {
    templates,
    loading,
    deleting,
    requestDelete,
    confirmDelete,
    confirmOpen,
    setConfirmOpen,
    confirmTarget,
    toggleTemplate,
    bulkActivate,
    bulkDeactivate,
    bulkDelete,
  } = useAssessmentBank();

  const handleEdit = (template: AssessmentTemplate) => {
    router.push(`/admin/assessment-bank/${template.id}/edit`);
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bank Asesmen</h1>
            <p className="mt-1 text-sm text-gray-500">
              Kelola template master komponen penilaian (CPMK/CPL) yang dapat
              digunakan di berbagai periode.
            </p>
          </div>
          <Button
            onClick={() => router.push("/admin/assessment-bank/new")}
            className="cursor-pointer gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Tambah Penilaian
          </Button>
        </div>

        <AssessmentBankTable
          templates={templates}
          loading={loading}
          onEdit={handleEdit}
          onDelete={requestDelete}
          onToggleActive={toggleTemplate}
          onBulkActivate={bulkActivate}
          onBulkDeactivate={bulkDeactivate}
          onBulkDelete={bulkDelete}
          deleting={deleting}
        />

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Hapus Komponen"
          description={`Apakah Anda yakin ingin menghapus "${confirmTarget?.code}"?`}
          confirmLabel="Hapus"
          cancelLabel="Batal"
          variant="destructive"
          onConfirm={confirmDelete}
        />
      </div>
    </div>
  );
}
