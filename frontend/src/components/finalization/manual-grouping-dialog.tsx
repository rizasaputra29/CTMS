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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import { AlertTriangle, UserPlus, Users, Info } from 'lucide-react';
import type { Student, Group } from '@/types/finalization';

interface ManualGroupingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentsWithoutGroup: Student[];
  existingGroups: Group[];
  loading: boolean;
  onCreateGroup: (studentIds: number[]) => Promise<void>;
  onAddToExisting: (studentIds: number[], groupId: number) => Promise<void>;
}

export function ManualGroupingDialog({
  open,
  onOpenChange,
  studentsWithoutGroup,
  existingGroups,
  loading,
  onCreateGroup,
  onAddToExisting,
}: ManualGroupingDialogProps) {
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [mode, setMode] = useState<'create' | 'add'>('create');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

  const handleClose = () => {
    setSelectedStudents([]);
    setMode('create');
    setSelectedGroupId(null);
    onOpenChange(false);
  };

  const toggleStudent = (studentId: number) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSubmit = async () => {
    if (selectedStudents.length === 0) return;

    if (mode === 'create') {
      await onCreateGroup(selectedStudents);
    } else if (mode === 'add' && selectedGroupId) {
      await onAddToExisting(selectedStudents, selectedGroupId);
    }

    handleClose();
  };

  const availableGroups = existingGroups.filter(
    (g) => g.members.length < 3 && g.status !== 'CLOSED' && g.status !== 'DISSOLVED'
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Grouping Manual
          </DialogTitle>
          <DialogDescription>
            Tambahkan mahasiswa tanpa kelompok ke grup yang sudah ada atau buat grup baru
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {studentsWithoutGroup.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Semua Mahasiswa Sudah Memiliki Kelompok</AlertTitle>
              <AlertDescription>
                Tidak ada mahasiswa yang perlu ditambahkan ke kelompok saat ini.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-700">
                  {studentsWithoutGroup.length} mahasiswa belum memiliki kelompok
                </AlertDescription>
              </Alert>

              {/* Mode Selection */}
              <div className="flex gap-2">
                <Button
                  variant={mode === 'create' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('create')}
                  className="flex-1"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Buat Grup Baru
                </Button>
                <Button
                  variant={mode === 'add' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMode('add')}
                  disabled={availableGroups.length === 0}
                  className="flex-1"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Tambah ke Grup
                </Button>
              </div>

              {mode === 'add' && availableGroups.length > 0 && (
                <div className="rounded-lg border p-3 space-y-2">
                  <Label>Pilih Grup Tujuan</Label>
                  <div className="space-y-2 max-h-[150px] overflow-y-auto">
                    {availableGroups.map((group) => (
                      <div
                        key={group.id}
                        className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                          selectedGroupId === group.id
                            ? 'bg-primary/10 border border-primary'
                            : 'hover:bg-muted border border-transparent'
                        }`}
                        onClick={() => setSelectedGroupId(group.id)}
                      >
                        <div>
                          <p className="font-medium text-sm">{group.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.title?.title || 'Belum ada judul'}
                          </p>
                        </div>
                        <Badge variant="secondary">{group.members.length}/3 anggota</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Student Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Pilih Mahasiswa</Label>
                  <span className="text-xs text-muted-foreground">
                    {selectedStudents.length} dipilih
                  </span>
                </div>
                <div className="h-[200px] rounded-lg border overflow-y-auto">
                  <div className="p-2 space-y-1">
                    {studentsWithoutGroup.map((student) => (
                      <div
                        key={student.id}
                        className="flex items-center space-x-2 p-2 hover:bg-muted rounded"
                      >
                        <Checkbox
                          checked={selectedStudents.includes(student.id)}
                          onCheckedChange={() => toggleStudent(student.id)}
                          id={`student-${student.id}`}
                        />
                        <Label
                          htmlFor={`student-${student.id}`}
                          className="flex-1 cursor-pointer text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span>{student.name}</span>
                            <span className="text-xs text-muted-foreground">{student.nim}</span>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Batal
          </Button>
          {studentsWithoutGroup.length > 0 && (
            <Button
              onClick={handleSubmit}
              disabled={
                loading ||
                selectedStudents.length === 0 ||
                (mode === 'add' && !selectedGroupId)
              }
            >
              {mode === 'create'
                ? `Buat Grup (${selectedStudents.length})`
                : `Tambah ke Grup (${selectedStudents.length})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
