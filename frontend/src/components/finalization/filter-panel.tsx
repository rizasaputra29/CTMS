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
import type { FilterPanelState } from '@/types/finalization';
import { isSupervisorStatus, isMemberCount } from '@/types/finalization';

interface FilterPanelProps {
  filters: FilterPanelState;
  onFilterChange: (filters: FilterPanelState) => void;
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 relative">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filter</span>
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-1">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter Options
            </h4>
            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  onFilterChange({
                    ...filters,
                    supervisorStatus: 'all',
                    memberCount: 'all',
                  });
                }}
              >
                Clear
              </Button>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
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
                      supervisorStatus: isSupervisorStatus(value) ? value : 'all',
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
                      memberCount: isMemberCount(value) ? value : 'all',
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

          {/* Active Filters Summary */}
          {activeFiltersCount > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Active Filters:</div>
                <div className="flex flex-wrap gap-1">
                  {showSupervisor && filters.supervisorStatus !== 'all' && (
                    <Badge variant="secondary" className="text-[10px]">
                      Supervisor: {filters.supervisorStatus}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() =>
                          onFilterChange({ ...filters, supervisorStatus: 'all' })
                        }
                      >
                        <X className="h-2.5 w-2.5 inline" />
                      </button>
                    </Badge>
                  )}
                  {showMemberCount && filters.memberCount !== 'all' && (
                    <Badge variant="secondary" className="text-[10px]">
                      Members: {filters.memberCount}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() =>
                          onFilterChange({ ...filters, memberCount: 'all' })
                        }
                      >
                        <X className="h-2.5 w-2.5 inline" />
                      </button>
                    </Badge>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
