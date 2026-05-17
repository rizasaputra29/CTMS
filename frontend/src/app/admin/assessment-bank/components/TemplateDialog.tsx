'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { assessmentBankTemplateSchema, type AssessmentBankTemplateFormData } from '@/lib/validations/assessment';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';

interface Template {
  id: number;
  code: string;
  name: string;
  description: string | null;
  weight: number;
  is_active: boolean;
}

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  onSave: (data: Partial<Template>) => void;
}

export function TemplateDialog({ open, onOpenChange, template, onSave }: TemplateDialogProps) {
  const form = useForm<AssessmentBankTemplateFormData>({
    resolver: zodResolver(assessmentBankTemplateSchema),
    mode: 'onBlur',
    defaultValues: {
      code: '',
      name: '',
      description: '',
      weight: 0,
      is_active: true,
    },
  });

  const isEditing = !!template;
  const isSubmitting = form.formState.isSubmitting;

  useEffect(() => {
    if (open) {
      if (template) {
        form.reset({
          code: template.code,
          name: template.name,
          description: template.description || '',
          weight: Number(template.weight),
          is_active: template.is_active,
        });
      } else {
        form.reset({
          code: '',
          name: '',
          description: '',
          weight: 0,
          is_active: true,
        });
      }
    }
  }, [template, open, form]);

  const handleSubmit = async (data: AssessmentBankTemplateFormData) => {
    await onSave({
      code: data.code,
      name: data.name,
      description: data.description,
      weight: Number(data.weight),
      is_active: data.is_active,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Template' : 'Create Template'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? 'Update the assessment component template details.'
              : 'Create a new assessment component template for use in period configurations.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="grid gap-6 py-4">
            {/* Code */}
            <Field>
              <FieldLabel htmlFor="code">
                Code <span className="text-destructive">*</span>
              </FieldLabel>
              <Controller
                name="code"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    id="code"
                    placeholder="e.g., CPMK-1, CPL-3, A-01"
                    {...field}
                    data-invalid={fieldState.error ? '' : undefined}
                    aria-invalid={fieldState.error ? 'true' : 'false'}
                  />
                )}
              />
              <FieldError>{form.formState.errors.code?.message}</FieldError>
              <p className="text-xs text-muted-foreground">
                Unique identifier for this component (e.g., CPMK-1, CPL-3)
              </p>
            </Field>

            {/* Name */}
            <Field>
              <FieldLabel htmlFor="name">
                Name <span className="text-destructive">*</span>
              </FieldLabel>
              <Controller
                name="name"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    id="name"
                    placeholder="e.g., Kemampuan Presentasi, Penguasaan Materi"
                    {...field}
                    data-invalid={fieldState.error ? '' : undefined}
                    aria-invalid={fieldState.error ? 'true' : 'false'}
                  />
                )}
              />
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </Field>

            {/* Description */}
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Controller
                name="description"
                control={form.control}
                render={({ field }) => (
                  <Textarea
                    id="description"
                    placeholder="Optional description of this assessment component..."
                    {...field}
                    value={field.value || ''}
                    rows={3}
                  />
                )}
              />
              <FieldError>{form.formState.errors.description?.message}</FieldError>
            </Field>

            {/* Weight */}
            <Field>
              <FieldLabel htmlFor="weight">
                Weight (%) <span className="text-destructive">*</span>
              </FieldLabel>
              <Controller
                name="weight"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Input
                    id="weight"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    placeholder="e.g., 25, 30"
                    {...field}
                    data-invalid={fieldState.error ? '' : undefined}
                    aria-invalid={fieldState.error ? 'true' : 'false'}
                  />
                )}
              />
              <FieldError>{form.formState.errors.weight?.message}</FieldError>
              <p className="text-xs text-muted-foreground">
                Weight percentage for this component (0-100)
              </p>
            </Field>

            {/* Active Status */}
            <Controller
              name="is_active"
              control={form.control}
              render={({ field }) => (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <label htmlFor="is_active" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Active
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Inactive templates won&apos;t appear in period configuration
                    </p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </div>
              )}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                isEditing ? 'Update Template' : 'Create Template'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
