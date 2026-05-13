'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface RecentItem {
  id: string | number;
  label: string;
  subtitle?: string;
  status?: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' };
  href?: string;
}

interface RecentListProps {
  items: RecentItem[];
  title?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  emptyMessage?: string;
  className?: string;
}

export function RecentList({ 
  items, 
  title, 
  viewAllHref, 
  viewAllLabel = 'View All', 
  emptyMessage = 'No items',
  className 
}: RecentListProps) {
  if (items.length === 0) {
    return (
      <div className={cn('rounded-xl border bg-card p-6', className)}>
        {title && <h3 className="font-semibold text-sm mb-4">{title}</h3>}
        <p className="text-sm text-muted-foreground text-center py-4">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border bg-card', className)}>
      {title && (
        <div className="flex items-center justify-between p-4 pb-3">
          <h3 className="font-semibold text-sm">{title}</h3>
          {viewAllHref && (
            <Link 
              href={viewAllHref}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {viewAllLabel} <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}
      <div className="divide-y divide-border">
        {items.map((item, i) => (
          <div key={item.id} className={cn(
            'flex items-center justify-between p-4',
            i < items.length - 1 && 'pb-4'
          )}>
            <div className="min-w-0 flex-1">
              {item.href ? (
                <Link href={item.href} className="text-sm font-medium hover:text-primary truncate block">
                  {item.label}
                </Link>
              ) : (
                <p className="text-sm font-medium truncate">{item.label}</p>
              )}
              {item.subtitle && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
              )}
            </div>
            {item.status && (
              <Badge variant={item.status.variant} className="ml-3 shrink-0">
                {item.status.label}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
