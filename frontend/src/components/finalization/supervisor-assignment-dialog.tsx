'use client';

// This component uses React Hook Form's watch() which cannot be safely memoized
// The React Compiler is configured to skip memoization for this component
import { useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, AlertTriangle } from 'lucide-react';
import type { Group, LecturerWithLoad } from '@/types/finalization';
import { supervisorAssignmentSchema, type SupervisorAssignmentFormData } from '@/lib/validations/finalization';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';

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
  loading: _loading,
  onSubmit,
}: SupervisorAssignmentDialogProps) {
  const form = useForm<SupervisorAssignmentFormData>({
    resolver: zodResolver(supervisorAssignmentSchema),
    mode: 'onBlur',
    defaultValues: {
      supervisor_1_id: undefined,
      supervisor_2_id: undefined,
      notes: '',
    },
  });

  const supervisor1Id = form.watch('supervisor_1_id');
  const supervisor2Id = form.watch('supervisor_2_id');

  const availableLecturers = useMemo(() => {
    return lecturers.filter((l) => !l.is_overloaded);
  }, [lecturers]);

  const selectedSupervisor1 = useMemo(() => {
    return lecturers.find((l) => l.id === supervisor1Id);
  }, [lecturers, supervisor1Id]);

  const selectedSupervisor2 = useMemo(() => {
    return lecturers.find((l) => l.id === supervisor2Id);
  }, [lecturers, supervisor2Id]);

  const handleSubmit = async (data: SupervisorAssignmentFormData) => {
    if (!data.supervisor_1_id) return;
    await onSubmit({
      supervisor_1_id: data.supervisor_1_id!,
      ...(data.supervisor_2_id ? { supervisor_2_id: data.supervisor_2_id } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
    });

    // Reset form
    form.reset();
  };

  const handleClose = () => {
    form.reset();
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

        <form onSubmit={form.handleSubmit(handleSubmit)}>
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
                    Group {group.id}
                  </Badge>
                ))}
                {selectedGroups.length > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{selectedGroups.length - 5} lainnya
                  </Badge>
                )}
              </div>
            </div>

            {form.formState.errors.root && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{form.formState.errors.root.message}</AlertDescription>
              </Alert>
            )}

            {/* Supervisor 1 Selection */}
            <Field>
              <FieldLabel htmlFor="supervisor-1">
                Supervisor 1 <span className="text-destructive">*</span>
              </FieldLabel>
              <Controller
                name="supervisor_1_id"
                control={form.control}
                render={({ field }) => (
                  <Select 
                    value={field.value?.toString() || ''} 
                    onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                  >
                    <SelectTrigger id="supervisor-1" data-invalid={form.formState.errors.supervisor_1_id ? '' : undefined}>
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
                )}
              />
              <FieldError>{form.formState.errors.supervisor_1_id?.message}</FieldError>

              {selectedSupervisor1 && (
                <div className="rounded-lg border p-3 space-y-2 mt-2">
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
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Supervisor ini sudah mencapai batas maksimum beban
                    </p>
                  )}
                </div>
              )}
            </Field>

            {/* Supervisor 2 Selection */}
            <Field>
              <FieldLabel htmlFor="supervisor-2">Supervisor 2 (Opsional)</FieldLabel>
              <Controller
                name="supervisor_2_id"
                control={form.control}
                render={({ field }) => (
                  <Select 
                    value={field.value?.toString() || ''} 
                    onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                  >
                    <SelectTrigger id="supervisor-2">
                      <SelectValue placeholder="Pilih Supervisor 2 (opsional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tidak ada</SelectItem>
                      {availableLecturers.map((lecturer) => (
                        <SelectItem
                          key={lecturer.id}
                          value={lecturer.id.toString()}
                          disabled={lecturer.id === supervisor1Id}
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
                )}
              />
              <FieldError>{form.formState.errors.supervisor_2_id?.message}</FieldError>

              {selectedSupervisor2 && (
                <div className="rounded-lg border p-3 space-y-2 mt-2">
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
            </Field>

            {/* Notes */}
            <Field>
              <FieldLabel htmlFor="notes">Catatan Finalisasi (Opsional)</FieldLabel>
              <Controller
                name="notes"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Textarea
                    id="notes"
                    placeholder="Tambahkan catatan untuk finalisasi ini..."
                    rows={3}
                    {...field}
                    value={field.value || ''}
                    data-invalid={fieldState.error ? '' : undefined}
                    aria-invalid={fieldState.error ? 'true' : 'false'}
                  />
                )}
              />
              <FieldError>{form.formState.errors.notes?.message}</FieldError>
            </Field>
          </div>
      </form>
    </DialogContent>
  </Dialog>
);
}
