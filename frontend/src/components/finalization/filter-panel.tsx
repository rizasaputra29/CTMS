'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Filter, SlidersHorizontal, UserCheck, Users } from 'lucide-react';

export interface FilterState {
  supervisorStatus: 'all' | 'missing_sv1' | 'missing_sv2' | 'complete';
  memberCount: 'all' | 'under_min' | 'in_range' | 'over_max';
}

interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  minGroupSize?: number;
  maxGroupSize?: number;
  showSupervisor?: boolean;
  showMemberCount?: boolean;
}

export function FilterPanel({
  filters,
  onFilterChange,
  minGroupSize = 3,
  maxGroupSize = 4,
  showSupervisor = false,
  showMemberCount = false,
}: FilterPanelProps) {
  // Return null if both filters are hidden
  if (!showSupervisor && !showMemberCount) {
    return null;
  }

  // Calculate active filters count (only count visible filters)
  const activeFiltersCount = (
    (showSupervisor && filters.supervisorStatus !== 'all' ? 1 : 0) +
    (showMemberCount && filters.memberCount !== 'all' ? 1 : 0)
  );

  const hasActiveFilters = activeFiltersCount > 0;

  const clearFilters = () => {
    onFilterChange({
      supervisorStatus: 'all',
      memberCount: 'all',
    });
  };

  const getSupervisorLabel = (value: string) => {
    const labels: Record<string, string> = {
      all: 'Semua',
      missing_sv1: 'Tanpa SV1',
      missing_sv2: 'Tanpa SV2',
      complete: 'Lengkap',
    };
    return labels[value] || value;
  };

  const getMemberCountLabel = (value: string) => {
    const labels: Record<string, string> = {
      all: 'Semua',
      under_min: `< ${minGroupSize}`,
      in_range: `${minGroupSize}-${maxGroupSize}`,
      over_max: `> ${maxGroupSize}`,
    };
    return labels[value] || value;
  };

  return (
    <div className="space-y-3">
      {/* Filter Trigger Button */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-4">
            {/* Popover Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filter</span>
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-7 text-xs"
                >
                  <X className="mr-1 h-3 w-3" />
                  Reset
                </Button>
              )}
            </div>

            <Separator />

            {/* Filter Controls */}
            <div className="space-y-4">
              {/* Supervisor Status Filter */}
              {showSupervisor && (
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" />
                    Status Supervisor
                  </Label>
                  <Select
                    value={filters.supervisorStatus}
                    onValueChange={(value) =>
                      onFilterChange({
                        ...filters,
                        supervisorStatus: value as FilterState['supervisorStatus'],
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Pilih status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua</SelectItem>
                      <SelectItem value="missing_sv1">Tanpa SV1</SelectItem>
                      <SelectItem value="missing_sv2">Tanpa SV2</SelectItem>
                      <SelectItem value="complete">Lengkap</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Member Count Filter */}
              {showMemberCount && (
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Jumlah Anggota
                  </Label>
                  <Select
                    value={filters.memberCount}
                    onValueChange={(value) =>
                      onFilterChange({
                        ...filters,
                        memberCount: value as FilterState['memberCount'],
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Pilih jumlah" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua</SelectItem>
                      <SelectItem value="under_min">{`< ${minGroupSize}`}</SelectItem>
                      <SelectItem value="in_range">{`${minGroupSize}-${maxGroupSize}`}</SelectItem>
                      <SelectItem value="over_max">{`> ${maxGroupSize}`}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {showSupervisor && filters.supervisorStatus !== 'all' && (
            <Badge variant="secondary" className="gap-1 px-2 py-1 text-xs">
              <UserCheck className="h-3 w-3" />
              {getSupervisorLabel(filters.supervisorStatus)}
              <button
                onClick={() =>
                  onFilterChange({ ...filters, supervisorStatus: 'all' })
                }
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {showMemberCount && filters.memberCount !== 'all' && (
            <Badge variant="secondary" className="gap-1 px-2 py-1 text-xs">
              <Users className="h-3 w-3" />
              {getMemberCountLabel(filters.memberCount)}
              <button
                onClick={() =>
                  onFilterChange({ ...filters, memberCount: 'all' })
                }
                className="ml-1 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
