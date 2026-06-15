"use client";

import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PeriodOption {
  id: number | string;
  name: string;
  is_active?: boolean;
}

interface PeriodSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  periods: PeriodOption[];
  loading?: boolean;
  placeholder?: string;
  allLabel?: string;
  className?: string;
  triggerClassName?: string;
  showActiveIndicator?: boolean;
}

export function PeriodSelector({
  value,
  onValueChange,
  periods,
  loading = false,
  placeholder = "Select Period",
  allLabel = "All Periods",
  className,
  triggerClassName,
  showActiveIndicator = true,
}: PeriodSelectorProps) {
  return (
    <div className={className}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Available Periods</SelectLabel>
            <SelectItem value="all">{allLabel}</SelectItem>
            {loading ? (
              <SelectItem value="loading" disabled>
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading...
                </span>
              </SelectItem>
            ) : (
              periods.map((period) => (
                <SelectItem key={period.id} value={period.id.toString()}>
                  {period.name}
                  {showActiveIndicator && period.is_active && " (Active)"}
                </SelectItem>
              ))
            )}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export type { PeriodOption, PeriodSelectorProps };
