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

interface Lecturer {
  id: number;
  name: string;
}

interface ManualGroupingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentsWithoutGroup: Student[];
  existingGroups: Group[];
  availableTitles: AvailableTitle[];
  lecturers: Lecturer[];
  loading: boolean;
  minGroupSize: number;
  maxGroupSize: number;
  onCreateGroup: (data: {
    studentIds: number[];
    option: 'no_title' | 'assign_title' | 'add_title';
    titleId?: number;
    newTitle?: {
      title: string;
      description?: string;
      specializations: string[];
      lecturerId: number;
    };
  }) => Promise<void>;
  onAddToExisting: (studentIds: number[], groupId: number) => Promise<void>;
}

export function ManualGroupingDialog({
  open,
  onOpenChange,
  studentsWithoutGroup,
  existingGroups,
  availableTitles,
  lecturers,
  loading,
  minGroupSize,
  maxGroupSize,
  onCreateGroup,
  onAddToExisting,
}: ManualGroupingDialogProps) {
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [mode, setMode] = useState<'create' | 'add'>('create');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  
  // Create group options: 'no_title' | 'assign_title' | 'add_title'
  const [createOption, setCreateOption] = useState<'no_title' | 'assign_title' | 'add_title'>('no_title');
  
  // For assign_title option
  const [selectedTitleId, setSelectedTitleId] = useState<number | null>(null);
  
  // For add_title option
  const [newTitle, setNewTitle] = useState({ title: '', description: '' });
  const [newTitleSpecializations, setNewTitleSpecializations] = useState<string[]>([]);
  const [selectedLecturerId, setSelectedLecturerId] = useState<number | null>(null);

  const resetForm = () => {
    setSelectedStudents([]);
    setMode('create');
    setSelectedGroupId(null);
    setCreateOption('no_title');
    setSelectedTitleId(null);
    setNewTitle({ title: '', description: '' });
    setNewTitleSpecializations([]);
    setSelectedLecturerId(null);
  };

  const handleClose = () => {
    resetForm();
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
      if (createOption === 'assign_title') {
        if (!selectedTitleId) {
          return;
        }
        await onCreateGroup({
          studentIds: selectedStudents,
          option: 'assign_title',
          titleId: selectedTitleId,
        });
      } else if (createOption === 'add_title') {
        if (!newTitle.title.trim() || newTitleSpecializations.length === 0 || !selectedLecturerId) {
          return;
        }
        const trimmedDescription = newTitle.description.trim();
        await onCreateGroup({
          studentIds: selectedStudents,
          option: 'add_title',
          newTitle: {
            title: newTitle.title.trim(),
            ...(trimmedDescription ? { description: trimmedDescription } : {}),
            specializations: newTitleSpecializations,
            lecturerId: selectedLecturerId,
          },
        });
      } else {
        // no_title
        await onCreateGroup({
          studentIds: selectedStudents,
          option: 'no_title',
        });
      }
    } else if (mode === 'add' && selectedGroupId) {
      await onAddToExisting(selectedStudents, selectedGroupId);
    }

    handleClose();
  };

  const availableGroups = existingGroups.filter(
    (g) => g.members.length < maxGroupSize && 
           g.status !== 'CLOSED' && 
           g.status !== 'DISSOLVED' &&
           g.status !== 'PDC1_ACTIVE' &&
           g.status !== 'PDC2_ACTIVE'
  );

  const canSubmit = () => {
    if (selectedStudents.length === 0) return false;
    
    if (mode === 'create') {
      // Strict validation for assign_title and add_title
      if (createOption === 'assign_title' || createOption === 'add_title') {
        const count = selectedStudents.length;
        if (count < minGroupSize || count > maxGroupSize) return false;
      }
      
      if (createOption === 'assign_title' && !selectedTitleId) return false;
      
      if (createOption === 'add_title') {
        if (!newTitle.title.trim()) return false;
        if (newTitleSpecializations.length === 0) return false;
        if (!selectedLecturerId) return false;
      }
      
      return true;
    }
    
    if (mode === 'add') {
      return !!selectedGroupId;
    }
    
    return false;
  };

  const selectedCount = selectedStudents.length;
  const isValidForTitleOptions = selectedCount >= minGroupSize && selectedCount <= maxGroupSize;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
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

              {/* Create Mode: 3 Options */}
              {mode === 'create' && (
                <div className="rounded-lg border p-4 space-y-4">
                  <Label className="text-base font-medium">Pilih Opsi Pembuatan Grup</Label>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {/* Option 1: Tanpa Judul */}
                    <div
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        createOption === 'no_title'
                          ? 'bg-primary/5 border-primary'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => setCreateOption('no_title')}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-4 h-4 rounded-full border mt-1 ${
                          createOption === 'no_title' ? 'bg-primary border-primary' : 'border-gray-300'
                        }`} />
                        <div className="flex-1">
                          <h4 className="font-medium">Tanpa Judul</h4>
                          <p className="text-sm text-muted-foreground">
                            Status: FORMING jika &lt; {minGroupSize} anggota, READY_FOR_BIDDING jika ≥ {minGroupSize}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Option 2: Assign Judul */}
                    <div
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        createOption === 'assign_title'
                          ? 'bg-primary/5 border-primary'
                          : 'hover:bg-muted'
                      } ${!isValidForTitleOptions ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => isValidForTitleOptions && setCreateOption('assign_title')}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-4 h-4 rounded-full border mt-1 ${
                          createOption === 'assign_title' ? 'bg-primary border-primary' : 'border-gray-300'
                        }`} />
                        <div className="flex-1">
                          <h4 className="font-medium">Assign Judul</h4>
                          <p className="text-sm text-muted-foreground">
                            Status: READY_FOR_FINALIZATION (wajib {minGroupSize}-{maxGroupSize} anggota)
                          </p>
                          {!isValidForTitleOptions && selectedCount > 0 && (
                            <p className="text-xs text-red-500 mt-1">
                              Pilih {minGroupSize}-{maxGroupSize} anggota untuk opsi ini
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Option 3: Tambah Judul */}
                    <div
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        createOption === 'add_title'
                          ? 'bg-primary/5 border-primary'
                          : 'hover:bg-muted'
                      } ${!isValidForTitleOptions ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => isValidForTitleOptions && setCreateOption('add_title')}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-4 h-4 rounded-full border mt-1 ${
                          createOption === 'add_title' ? 'bg-primary border-primary' : 'border-gray-300'
                        }`} />
                        <div className="flex-1">
                          <h4 className="font-medium">Tambah Judul Baru</h4>
                          <p className="text-sm text-muted-foreground">
                            Status: READY_FOR_FINALIZATION (wajib {minGroupSize}-{maxGroupSize} anggota + pilih dosen)
                          </p>
                          {!isValidForTitleOptions && selectedCount > 0 && (
                            <p className="text-xs text-red-500 mt-1">
                              Pilih {minGroupSize}-{maxGroupSize} anggota untuk opsi ini
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Option 2 Details: Select Title */}
                  {createOption === 'assign_title' && isValidForTitleOptions && (
                    <div className="space-y-3 pt-2 border-t">
                      <Label className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Pilih Judul Tersedia
                      </Label>
                      
                      {availableTitles.length === 0 ? (
                        <Alert className="bg-muted">
                          <AlertDescription className="text-sm">
                            Tidak ada judul yang tersedia. Pilih opsi Tambah Judul Baru.
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

                  {/* Option 3 Details: Create New Title */}
                  {createOption === 'add_title' && isValidForTitleOptions && (
                    <div className="space-y-3 pt-2 border-t">
                      <Label className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Buat Judul Baru
                      </Label>
                      
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="new-title">Judul</Label>
                          <Input
                            id="new-title"
                            placeholder="Masukkan judul..."
                            value={newTitle.title}
                            onChange={(e) => setNewTitle({ ...newTitle, title: e.target.value })}
                          />
                        </div>
                        
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

                        <div className="space-y-2">
                          <Label>Peminatan</Label>
                          <SpecializationSelector
                            selected={newTitleSpecializations}
                            onChange={setNewTitleSpecializations}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Dosen Pemilik Judul</Label>
                          <Select
                            disabled={lecturers.length === 0}
                            value={selectedLecturerId?.toString() || ''}
                            onValueChange={(value) => setSelectedLecturerId(parseInt(value))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih dosen" />
                            </SelectTrigger>
                            <SelectContent>
                              {lecturers.map((lecturer) => (
                                <SelectItem key={lecturer.id} value={lecturer.id.toString()}>
                                  {lecturer.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {lecturers.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              Daftar dosen belum tersedia. Tutup dan buka ulang dialog untuk memuat ulang data.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Add to Existing Mode */}
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
                          <p className="font-medium text-sm">{group.code || `Group ${group.id}`}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.title?.title || 'Belum ada judul'} • {group.status}
                          </p>
                        </div>
                        <Badge variant="secondary">{group.members.length}/{maxGroupSize} anggota</Badge>
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
                    {selectedCount} dipilih
                    {(createOption === 'assign_title' || createOption === 'add_title') && (
                      <span className={`ml-2 ${isValidForTitleOptions ? 'text-green-600' : 'text-red-500'}`}>
                        (wajib {minGroupSize}-{maxGroupSize})
                      </span>
                    )}
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
                ? `Buat Grup (${selectedCount})`
                : `Tambah ke Grup (${selectedCount})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
