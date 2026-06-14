"use client";

import { Check, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DataTableFilterOption {
  value: string;
  label: string;
}

interface DataTableFilterPopoverProps {
  label: string;
  icon: LucideIcon;
  options: DataTableFilterOption[];
  value: string;
  onChange: (value: string) => void;
}

export function DataTableFilterPopover({
  label,
  icon: Icon,
  options,
  value,
  onChange,
}: DataTableFilterPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 cursor-pointer gap-2 bg-white"
        >
          <Icon className="h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className="hover:bg-accent hover:text-accent-foreground flex w-full cursor-pointer items-center rounded-sm px-3 py-2 text-sm"
          >
            <span className="mr-2 w-4">
              {value === option.value && <Check className="h-4 w-4" />}
            </span>
            {option.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
