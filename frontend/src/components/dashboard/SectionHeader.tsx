'use client';

import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  description?: string;
  count?: number;
  className?: string;
}

export function SectionHeader({ title, description, count, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between pb-3', className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {count !== undefined && (
        <span className="text-sm text-muted-foreground">{count} items</span>
      )}
    </div>
  );
}
