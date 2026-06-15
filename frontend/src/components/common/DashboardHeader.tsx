"use client";

import { Loader2 } from "lucide-react";
import { PeriodSelector, type PeriodOption } from "./PeriodSelector";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  userName?: string | null;
  loading?: boolean;
  showPeriodSelector?: boolean;
  periodValue?: string;
  onPeriodChange?: (value: string) => void;
  periods?: PeriodOption[];
  periodLoading?: boolean;
  periodPlaceholder?: string;
  periodAllLabel?: string;
  className?: string;
  action?: React.ReactNode;
}

export function DashboardHeader({
  title,
  subtitle,
  userName,
  loading = false,
  showPeriodSelector = false,
  periodValue,
  onPeriodChange,
  periods = [],
  periodLoading = false,
  periodPlaceholder,
  periodAllLabel,
  className,
  action,
}: DashboardHeaderProps) {
  const displayTitle = userName ? `${title}, ${userName.split(" ")[0]}!` : title;

  return (
    <div
      className={cn(
        "mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end",
        className
      )}
    >
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{displayTitle}</h1>
        {subtitle && (
          <p className="text-muted-foreground">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {showPeriodSelector && onPeriodChange && (
          <>
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              View Period:
            </span>
            <PeriodSelector
              value={periodValue ?? "all"}
              onValueChange={onPeriodChange}
              periods={periods}
              loading={periodLoading}
              placeholder={periodPlaceholder}
              allLabel={periodAllLabel}
              triggerClassName="h-8 w-[200px] text-xs"
            />
          </>
        )}
        {loading && (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        )}
        {action}
      </div>
    </div>
  );
}

export type { DashboardHeaderProps };
