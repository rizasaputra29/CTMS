'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CheckCircle, XCircle, FileDown, ChevronDown } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onMarkFinal?: () => void;
  onCancelFinal?: () => void;
  onExport?: () => void;
  showMarkFinal?: boolean;
  showCancelFinal?: boolean;
  showExport?: boolean;
  loading?: boolean;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onSelectNone,
  onMarkFinal,
  onCancelFinal,
  onExport,
  showMarkFinal = false,
  showCancelFinal = false,
  showExport = true,
  loading = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) {
    return (
      <div className="flex items-center gap-4 py-2 px-4 bg-muted/50 rounded-md">
        <Checkbox
          checked={false}
          onCheckedChange={onSelectAll}
          aria-label="Select all"
        />
        <span className="text-sm text-muted-foreground">
          Pilih semua ({totalCount} item)
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 px-4 bg-primary/5 border border-primary/20 rounded-md">
      <div className="flex items-center gap-4">
        <Checkbox
          checked={selectedCount === totalCount}
          onCheckedChange={(checked) => {
            if (checked) {
              onSelectAll();
            } else {
              onSelectNone();
            }
          }}
          aria-label={`${selectedCount} of ${totalCount} selected`}
        />
        <span className="text-sm font-medium">
          {selectedCount} dari {totalCount} dipilih
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSelectNone}
          className="h-7 text-xs"
        >
          Batal pilih
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {showMarkFinal && onMarkFinal && (
          <Button
            size="sm"
            onClick={onMarkFinal}
            disabled={loading}
            className="h-8"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Mark Kelompok Final
          </Button>
        )}

        {showCancelFinal && onCancelFinal && (
          <Button
            size="sm"
            variant="outline"
            onClick={onCancelFinal}
            disabled={loading}
            className="h-8"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Cancel Final
          </Button>
        )}

        {showExport && onExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={loading}
                className="h-8"
              >
                <FileDown className="mr-2 h-4 w-4" />
                Export
                <ChevronDown className="ml-2 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExport}>
                Export Selected (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
