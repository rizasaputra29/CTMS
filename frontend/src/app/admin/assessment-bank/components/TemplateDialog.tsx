'use client';

import { useState, useEffect } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

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
  const [formData, setFormData] = useState<Partial<Template>>({
    code: '',
    name: '',
    description: '',
    weight: 0,
    is_active: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isEditing = !!template;

  useEffect(() => {
    if (template) {
      setFormData({
        code: template.code,
        name: template.name,
        description: template.description || '',
        weight: template.weight,
        is_active: template.is_active,
      });
    } else {
      setFormData({
        code: '',
        name: '',
        description: '',
        weight: 0,
        is_active: true,
      });
    }
    setErrors({});
  }, [template, open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.code?.trim()) {
      newErrors.code = 'Code is required';
    } else if (formData.code.length > 50) {
      newErrors.code = 'Code must be less than 50 characters';
    }

    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length > 255) {
      newErrors.name = 'Name must be less than 255 characters';
    }

    if (formData.weight === undefined || formData.weight === null) {
      newErrors.weight = 'Weight is required';
    } else if (formData.weight < 0 || formData.weight > 100) {
      newErrors.weight = 'Weight must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await onSave({
        ...formData,
        weight: Number(formData.weight),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof Template, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
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

        <div className="grid gap-6 py-4">
          {/* Code */}
          <div className="grid gap-2">
            <Label htmlFor="code">
              Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="code"
              placeholder="e.g., CPMK-1, CPL-3, A-01"
              value={formData.code}
              onChange={(e) => handleChange('code', e.target.value)}
              className={errors.code ? 'border-destructive' : ''}
            />
            {errors.code && (
              <p className="text-sm text-destructive">{errors.code}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Unique identifier for this component (e.g., CPMK-1, CPL-3)
            </p>
          </div>

          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Kemampuan Presentasi, Penguasaan Materi"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description of this assessment component..."
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
            />
          </div>

          {/* Weight */}
          <div className="grid gap-2">
            <Label htmlFor="weight">
              Weight (%) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="weight"
              type="number"
              min={0}
              max={100}
              step={0.01}
              placeholder="e.g., 25, 30"
              value={formData.weight}
              onChange={(e) => handleChange('weight', e.target.value)}
              className={errors.weight ? 'border-destructive' : ''}
            />
            {errors.weight && (
              <p className="text-sm text-destructive">{errors.weight}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Weight percentage for this component (0-100)
            </p>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Active</Label>
              <p className="text-sm text-muted-foreground">
                Inactive templates won&apos;t appear in period configuration
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => handleChange('is_active', checked)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              isEditing ? 'Update Template' : 'Create Template'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
