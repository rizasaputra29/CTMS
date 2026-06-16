'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

export interface FilterBadgeGroupProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label?: string;
}

export function FilterBadgeGroup({ options, selected, onChange, label = 'Filter' }: FilterBadgeGroupProps) {
  const toggleOption = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter(s => s !== option)
        : [...selected, option]
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-grey-600">{label}</span>
        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-xs text-grey-400 hover:text-grey-600 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const isActive = selected.includes(option);
          return (
            <Badge
              key={option}
              variant={isActive ? 'default' : 'outline'}
              className="cursor-pointer select-none transition-colors"
              onClick={() => toggleOption(option)}
            >
              {option}
              {isActive && <X className="ml-1 h-3 w-3" />}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
