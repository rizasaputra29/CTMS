'use client';

import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const cardVariants = cva('rounded-xl border bg-card text-card-foreground shadow-sm', {
  variants: {
    variant: {
      default: '',
      primary: 'border-primary/20 bg-primary/5',
      success: 'border-green-200 bg-green-50',
      warning: 'border-yellow-200 bg-yellow-50',
      danger: 'border-red-200 bg-red-50',
    },
  },
  defaultVariants: { variant: 'default' },
});

interface StatsCardProps extends VariantProps<typeof cardVariants> {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: string; positive: boolean };
  className?: string;
}

export function StatsCard({ title, value, subtitle, icon: Icon, trend, variant, className }: StatsCardProps) {
  return (
    <div className={cn(cardVariants({ variant }), 'p-5', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={cn('text-xs font-medium mt-1', trend.positive ? 'text-green-600' : 'text-red-600')}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div className={cn(
          'rounded-lg p-3',
          variant === 'primary' && 'bg-primary/10 text-primary',
          variant === 'success' && 'bg-green-100 text-green-700',
          variant === 'warning' && 'bg-yellow-100 text-yellow-700',
          variant === 'danger' && 'bg-red-100 text-red-700',
          !variant && 'bg-muted text-muted-foreground',
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
