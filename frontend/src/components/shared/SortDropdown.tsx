'use client';

import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface SortOption {
  key: string;
  label: string;
}

export interface SortDropdownProps {
  options: SortOption[];
  value: string | null;
  direction: 'asc' | 'desc';
  onChange: (key: string, direction: 'asc' | 'desc') => void;
  className?: string;
}

export function SortDropdown({ options, value, direction, onChange, className }: SortDropdownProps) {
  const selectedLabel = options.find(o => o.key === value)?.label || 'Sort by';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <ArrowUpDown className="mr-2 h-4 w-4" />
          {value ? (
            <span className="flex items-center gap-1">
              {selectedLabel}
              {direction === 'asc' ? (
                <ArrowUp className="h-3 w-3" />
              ) : (
                <ArrowDown className="h-3 w-3" />
              )}
            </span>
          ) : (
            'Sort by'
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map(option => {
          const isActive = option.key === value;
          return (
            <DropdownMenuItem
              key={option.key}
              onClick={() => {
                if (isActive) {
                  onChange(option.key, direction === 'asc' ? 'desc' : 'asc');
                } else {
                  onChange(option.key, 'asc');
                }
              }}
            >
              <span className="flex items-center gap-2 w-full">
                {option.label}
                {isActive && (
                  direction === 'asc' ? (
                    <ArrowUp className="h-3 w-3 ml-auto" />
                  ) : (
                    <ArrowDown className="h-3 w-3 ml-auto" />
                  )
                )}
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
