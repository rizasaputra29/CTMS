'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Users, AlertTriangle } from 'lucide-react';
import type { Group, LecturerWithLoad } from '@/types/finalization';

interface SupervisorAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedGroups: Group[];
  lecturers: LecturerWithLoad[];
  loading: boolean;
  onSubmit: (data: {
    supervisor_1_id: number;
    supervisor_2_id?: number;
    notes?: string;
  }) => Promise<void>;
}

export function SupervisorAssignmentDialog({
  open,
  onOpenChange,
  selectedGroups,
  lecturers,
  loading,
  onSubmit,
}: SupervisorAssignmentDialogProps) {
  const [supervisor1Id, setSupervisor1Id] = useState<string>('');
  const [supervisor2Id, setSupervisor2Id] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const availableLecturers = useMemo(() => {
    return lecturers.filter((l) => !l.is_overloaded);
  }, [lecturers]);

  const selectedSupervisor1 = useMemo(() => {
    return lecturers.find((l) => l.id.toString() === supervisor1Id);
  }, [lecturers, supervisor1Id]);

  const selectedSupervisor2 = useMemo(() => {
    return lecturers.find((l) => l.id.toString() === supervisor2Id);
  }, [lecturers, supervisor2Id]);

  const handleSubmit = async () => {
    setError(null);

    if (!supervisor1Id) {
      setError('Supervisor 1 wajib dipilih');
      return;
    }

    if (supervisor1Id === supervisor2Id) {
      setError('Supervisor 1 dan 2 tidak boleh sama');
      return;
    }

    await onSubmit({
      supervisor_1_id: parseInt(supervisor1Id),
      supervisor_2_id: supervisor2Id ? parseInt(supervisor2Id) : undefined,
      notes: notes || undefined,
    });

    // Reset form
    setSupervisor1Id('');
    setSupervisor2Id('');
    setNotes('');
  };

  const handleClose = () => {
    setSupervisor1Id('');
    setSupervisor2Id('');
    setNotes('');
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Tetapkan Supervisor</DialogTitle>
          <DialogDescription>
            Tetapkan supervisor untuk {selectedGroups.length} kelompok yang dipilih
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected groups summary */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              <span className="font-medium">{selectedGroups.length} Kelompok Terpilih</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedGroups.slice(0, 5).map((group) => (
                <Badge key={group.id} variant="secondary" className="text-xs">
                  {group.code || `Group ${group.id}`}
                </Badge>
              ))}
              {selectedGroups.length > 5 && (
                <Badge variant="secondary" className="text-xs">
                  +{selectedGroups.length - 5} lainnya
                </Badge>
              )}
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Supervisor 1 Selection */}
          <div className="space-y-2">
            <Label htmlFor="supervisor-1">
              Supervisor 1 <span className="text-red-500">*</span>
            </Label>
            <Select value={supervisor1Id} onValueChange={setSupervisor1Id}>
              <SelectTrigger id="supervisor-1">
                <SelectValue placeholder="Pilih Supervisor 1" />
              </SelectTrigger>
              <SelectContent>
                {lecturers.map((lecturer) => (
                  <SelectItem
                    key={lecturer.id}
                    value={lecturer.id.toString()}
                    disabled={lecturer.is_overloaded}
                  >
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{lecturer.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {lecturer.current_load}/{lecturer.max_load} grup
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedSupervisor1 && (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Beban Saat Ini</span>
                  <span className="font-medium">
                    {selectedSupervisor1.current_load} / {selectedSupervisor1.max_load} grup
                  </span>
                </div>
                <Progress
                  value={(selectedSupervisor1.current_load / selectedSupervisor1.max_load) * 100}
                  className={selectedSupervisor1.is_overloaded ? 'bg-red-500' : ''}
                />
                {selectedSupervisor1.is_overloaded && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Supervisor ini sudah mencapai batas maksimum beban
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Supervisor 2 Selection */}
          <div className="space-y-2">
            <Label htmlFor="supervisor-2">Supervisor 2 (Opsional)</Label>
            <Select value={supervisor2Id} onValueChange={setSupervisor2Id}>
              <SelectTrigger id="supervisor-2">
                <SelectValue placeholder="Pilih Supervisor 2 (opsional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tidak ada</SelectItem>
                {availableLecturers.map((lecturer) => (
                  <SelectItem
                    key={lecturer.id}
                    value={lecturer.id.toString()}
                    disabled={lecturer.id.toString() === supervisor1Id}
                  >
                    <div className="flex items-center justify-between w-full gap-4">
                      <span>{lecturer.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {lecturer.current_load}/{lecturer.max_load} grup
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedSupervisor2 && (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Beban Saat Ini</span>
                  <span className="font-medium">
                    {selectedSupervisor2.current_load} / {selectedSupervisor2.max_load} grup
                  </span>
                </div>
                <Progress
                  value={(selectedSupervisor2.current_load / selectedSupervisor2.max_load) * 100}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Catatan Finalisasi (Opsional)</Label>
            <Textarea
              id="notes"
              placeholder="Tambahkan catatan untuk finalisasi ini..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !supervisor1Id}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              `Tetapkan Supervisor (${selectedGroups.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
