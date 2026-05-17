'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertTriangle, CheckCircle, Users, GraduationCap, Shield } from 'lucide-react';
import type { Group } from '@/types/finalization';

interface FinalizationExecuteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: Group[];
  stats: {
    total_ready: number;
    total_kelompok_final: number;
    can_finalize: boolean;
  } | null;
  loading: boolean;
  onConfirm: () => Promise<void>;
}

export function FinalizationExecuteDialog({
  open,
  onOpenChange,
  groups,
  stats,
  loading,
  onConfirm,
}: FinalizationExecuteDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleClose = () => {
    setConfirmed(false);
    setShowDetails(false);
    onOpenChange(false);
  };

  const handleConfirm = async () => {
    if (!confirmed) return;
    await onConfirm();
    handleClose();
  };

  const groupsWithSupervisor1 = groups.filter((g) => g.supervisor_1_id);
  const groupsWithoutSupervisor1 = groups.filter((g) => !g.supervisor_1_id);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Eksekusi Finalisasi
          </DialogTitle>
          <DialogDescription>
            Finalisasi akan mengubah status semua KELOMPOK_FINAL menjadi PDC1_ACTIVE
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                Total Grup
              </div>
              <div className="mt-1 text-2xl font-bold">{groups.length}</div>
            </div>
            <div className="rounded-lg border bg-green-50 p-3">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <GraduationCap className="h-4 w-4" />
                Siap Finalisasi
              </div>
              <div className="mt-1 text-2xl font-bold text-green-700">
                {groupsWithSupervisor1.length}
              </div>
            </div>
          </div>

          {/* Validation Status */}
          {groupsWithoutSupervisor1.length > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Finalisasi Tidak Dapat Dilakukan</AlertTitle>
              <AlertDescription>
                Terdapat {groupsWithoutSupervisor1.length} grup KELOMPOK_FINAL yang belum memiliki
                Supervisor 1. Semua grup harus memiliki supervisor sebelum difinalisasi.
              </AlertDescription>
            </Alert>
          ) : stats?.total_ready && stats.total_ready > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Finalisasi Tidak Dapat Dilakukan</AlertTitle>
              <AlertDescription>
                Masih terdapat {stats.total_ready} grup dalam status READY_FOR_FINALIZATION. Semua
                grup harus menjadi KELOMPOK_FINAL terlebih dahulu.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Siap Finalisasi</AlertTitle>
              <AlertDescription className="text-green-700">
                Semua grup telah memenuhi syarat untuk difinalisasi.
              </AlertDescription>
            </Alert>
          )}

          {/* Groups List */}
          <div className="space-y-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              {showDetails ? 'Sembunyikan' : 'Lihat'} daftar grup ({groups.length})
            </button>

            {showDetails && (
              <div className="max-h-[200px] overflow-y-auto rounded-lg border">
                <div className="divide-y">
                  {groups.map((group) => (
                    <div key={group.id} className="flex items-center justify-between p-3">
                      <div>
                        <p className="font-medium text-sm">{group.code || `Group ${group.id}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.supervisor1?.name || 'Belum ada supervisor'}
                        </p>
                      </div>
                      {group.supervisor_1_id ? (
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          Siap
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          Perlu Supervisor
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Confirmation */}
          <div className="flex items-start space-x-2">
            <Checkbox
              id="confirm"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked as boolean)}
              disabled={groupsWithoutSupervisor1.length > 0 || (stats?.total_ready ?? 0) > 0}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="confirm"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Saya mengerti dan ingin melanjutkan finalisasi
              </Label>
              <p className="text-xs text-muted-foreground">
                Aksi ini akan mengubah status {groups.length} grup menjadi PDC1_ACTIVE dan memulai
                tahap penulisan.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Batal
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              loading ||
              !confirmed ||
              groupsWithoutSupervisor1.length > 0 ||
              (stats?.total_ready ?? 0) > 0
            }
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memproses...
              </>
            ) : (
              `Finalisasi ${groups.length} Grup`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
