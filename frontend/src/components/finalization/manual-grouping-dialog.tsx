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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { AlertTriangle, UserPlus, Users, Info, FileText, Plus } from 'lucide-react';
import { SpecializationSelector } from '@/components/ui/specialization-selector';
import type { Student, Group } from '@/types/finalization';

interface AvailableTitle {
  id: number;
  title: string;
  description?: string;
  quota: number;
  lecturer?: {
    id: number;
    name: string;
  };
}

interface ManualGroupingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentsWithoutGroup: Student[];
  existingGroups: Group[];
  availableTitles: AvailableTitle[];
  loading: boolean;
  onCreateGroup: (
    studentIds: number[],
    titleId?: number,
    newTitle?: { title: string; description?: string; specializations: string[] }
  ) => Promise<void>;
  onAddToExisting: (studentIds: number[], groupId: number) => Promise<void>;
}

export function ManualGroupingDialog({
  open,
  onOpenChange,
  studentsWithoutGroup,
  existingGroups,
  availableTitles,
  loading,
  onCreateGroup,
  onAddToExisting,
}: ManualGroupingDialogProps) {
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [mode, setMode] = useState<'create' | 'add'>('create');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  
  // Title selection state for create mode
  const [titleMode, setTitleMode] = useState<'none' | 'existing' | 'new'>('none');
  const [selectedTitleId, setSelectedTitleId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState({ title: '', description: '' });
  const [newTitleSpecializations, setNewTitleSpecializations] = useState<string[]>([]);

  const handleClose = () => {
    setSelectedStudents([]);
    setMode('create');
    setSelectedGroupId(null);
    setTitleMode('none');
    setSelectedTitleId(null);
    setNewTitle({ title: '', description: '' });
    setNewTitleSpecializations([]);
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
      let titleId: number | undefined;
      let newTitleData: { title: string; description?: string; specializations: string[] } | undefined;

      if (titleMode === 'existing' && selectedTitleId) {
        titleId = selectedTitleId;
      } else if (titleMode === 'new' && newTitle.title.trim()) {
        newTitleData = {
          title: newTitle.title.trim(),
          description: newTitle.description.trim() || undefined,
          specializations: newTitleSpecializations,
        };
      }

      await onCreateGroup(selectedStudents, titleId, newTitleData);
    } else if (mode === 'add' && selectedGroupId) {
      await onAddToExisting(selectedStudents, selectedGroupId);
    }

    handleClose();
  };

  const availableGroups = existingGroups.filter(
    (g) => g.members.length < 3 && g.status !== 'CLOSED' && g.status !== 'DISSOLVED'
  );

  const canSubmit = () => {
    if (selectedStudents.length === 0) return false;
    
    if (mode === 'create') {
      if (titleMode === 'existing' && !selectedTitleId) return false;
      if (titleMode === 'new') {
        if (!newTitle.title.trim()) return false;
        if (newTitleSpecializations.length === 0) return false;
      }
      return true;
    }
    
    if (mode === 'add') {
      return !!selectedGroupId;
    }
    
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
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

              {/* Create Mode: Title Selection */}
              {mode === 'create' && (
                <div className="rounded-lg border p-3 space-y-3">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Judul (Opsional)
                  </Label>
                  
                  <Select
                    value={titleMode}
                    onValueChange={(value: 'none' | 'existing' | 'new') => {
                      setTitleMode(value);
                      setSelectedTitleId(null);
                      setNewTitle({ title: '', description: '' });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih opsi judul" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanpa Judul (Nanti)</SelectItem>
                      <SelectItem value="existing">Pilih Judul Tersedia</SelectItem>
                      <SelectItem value="new">Buat Judul Baru</SelectItem>
                    </SelectContent>
                  </Select>

                  {titleMode === 'existing' && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Pilih Judul</Label>
                      {availableTitles.length === 0 ? (
                        <Alert className="bg-muted">
                          <AlertDescription className="text-sm">
                            Tidak ada judul yang tersedia. Buat judul baru atau pilih tanpa judul.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="space-y-2 max-h-[150px] overflow-y-auto border rounded-lg p-2">
                          {availableTitles.map((title) => (
                            <div
                              key={title.id}
                              className={`p-2 rounded cursor-pointer transition-colors ${
                                selectedTitleId === title.id
                                  ? 'bg-primary/10 border border-primary'
                                  : 'hover:bg-muted border border-transparent'
                              }`}
                              onClick={() => setSelectedTitleId(title.id)}
                            >
                              <p className="font-medium text-sm">{title.title}</p>
                              {title.lecturer && (
                                <p className="text-xs text-muted-foreground">
                                  Dosen: {title.lecturer.name}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {titleMode === 'new' && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="new-title">
                          Judul Baru <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="new-title"
                          placeholder="Masukkan judul..."
                          value={newTitle.title}
                          onChange={(e) => setNewTitle({ ...newTitle, title: e.target.value })}
                        />
                      </div>
                      <SpecializationSelector
                        selected={newTitleSpecializations}
                        onChange={setNewTitleSpecializations}
                        required
                      />
                      <div className="space-y-2">
                        <Label htmlFor="new-description">Deskripsi (Opsional)</Label>
                        <Textarea
                          id="new-description"
                          placeholder="Masukkan deskripsi..."
                          value={newTitle.description}
                          onChange={(e) => setNewTitle({ ...newTitle, description: e.target.value })}
                          rows={3}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Add to Existing Mode: Group Selection */}
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
              disabled={loading || !canSubmit()}
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