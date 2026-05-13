'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';

interface QuickAction {
  label: string;
  href: string;
  icon: React.ElementType;
  description?: string;
}

interface QuickActionsProps {
  actions: QuickAction[];
  className?: string;
}

export function QuickActions({ actions, className }: QuickActionsProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3', className)}>
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors hover:bg-muted/50 hover:border-primary/30"
        >
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <action.icon className="h-5 w-5" />
          </div>
          <span className="text-sm font-medium">{action.label}</span>
          {action.description && (
            <span className="text-xs text-muted-foreground leading-tight">{action.description}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
