'use client';

import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export const SPECIALIZATIONS = [
  'Software',
  'Embedded', 
  'Network',
  'Multimedia',
  'AI',
  'Blockchain',
] as const;

export type Specialization = (typeof SPECIALIZATIONS)[number];

interface SpecializationSelectorProps {
  selected: string[];
  onChange: (specializations: string[]) => void;
  required?: boolean;
  className?: string;
  label?: string;
}

export function SpecializationSelector({
  selected,
  onChange,
  required = false,
  className,
  label = 'Peminatan',
}: SpecializationSelectorProps) {
  const toggleSpec = (spec: string) => {
    onChange(
      selected.includes(spec)
        ? selected.filter((s) => s !== spec)
        : [...selected, spec]
    );
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <div className="flex flex-wrap gap-3">
        {SPECIALIZATIONS.map((spec) => (
          <label
            key={spec}
            className="flex items-center gap-2 cursor-pointer hover:bg-muted px-2 py-1 rounded"
          >
            <Checkbox
              checked={selected.includes(spec)}
              onCheckedChange={() => toggleSpec(spec)}
            />
            <span className="text-sm">{spec}</span>
          </label>
        ))}
      </div>
      {required && selected.length === 0 && (
        <p className="text-xs text-destructive">Pilih minimal 1 peminatan</p>
      )}
    </div>
  );
}