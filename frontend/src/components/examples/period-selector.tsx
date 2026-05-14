'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface Period {
  id: number;
  name: string;
  is_active: boolean;
}

interface PeriodSelectorProps {
  periods: Period[];
  activePeriod: Period | null;
}

// Client Component for period selection (needs interactivity)
export function PeriodSelector({ periods, activePeriod }: PeriodSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  const currentPeriod = searchParams.get('period_id') || activePeriod?.id?.toString() || 'all';
  
  const handleChange = (periodId: string) => {
    const params = new URLSearchParams(searchParams);
    if (periodId && periodId !== 'all') {
      params.set('period_id', periodId);
    } else {
      params.delete('period_id');
    }
    
    // Reset page when period changes
    params.delete('page');
    
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };
  
  if (isPending) {
    return <Skeleton className="h-10 w-[200px]" />;
  }
  
  return (
    <Select value={currentPeriod} onValueChange={handleChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Periods</SelectItem>
        {periods.map((period) => (
          <SelectItem key={period.id} value={period.id.toString()}>
            {period.name}
            {period.is_active && (
              <span className="ml-2 text-xs text-muted-foreground">(active)</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Loading fallback
export function PeriodSelectorSkeleton() {
  return <Skeleton className="h-10 w-[200px]" />;
}
