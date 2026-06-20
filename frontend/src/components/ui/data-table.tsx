'use client';

import * as React from 'react';
import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import {
  Search,
  ArrowUpDown,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';

/* =========================================================
   Types
   ========================================================= */

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  /** Custom render function for the cell */
  render?: (row: T, index: number) => React.ReactNode;
}

export interface DataTablePagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface DataTableProps<T> {
  /** Card title displayed in header */
  title: string;
  /** Array of data rows */
  data: T[];
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Loading state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state sub-message */
  emptySubMessage?: string;
  /** Icon displayed in empty state */
  emptyIcon?: React.ReactNode;
  /** Enable row checkbox selection */
  showCheckbox?: boolean;
  /** Set of selected row IDs */
  selectedIds?: Set<number | string>;
  /** Toggle all rows */
  onToggleSelectAll?: () => void;
  /** Toggle single row */
  onToggleSelectOne?: (id: number | string) => void;
  /** Key used to extract unique row ID (default: 'id') */
  rowIdKey?: string;
  /** Search input value */
  searchValue?: string;
  /** Search input change handler */
  onSearchChange?: (value: string) => void;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Current sort key */
  sortKey?: string;
  /** Current sort direction */
  sortDir?: 'asc' | 'desc';
  /** Sort handler - receives column key */
  onSort?: (key: string) => void;
  /** Custom filter dropdown slot (replaces default filter) */
  filterSlot?: React.ReactNode;
  /** Additional actions displayed in header right side */
  actions?: React.ReactNode;
  /** Pagination data */
  pagination?: DataTablePagination;
  /** Page change handler */
  onPageChange?: (page: number) => void;
  /** Per-page change handler */
  onPerPageChange?: (perPage: number) => void;
  /** Whether rows are clickable (adds cursor-pointer) */
  rowClickable?: boolean;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Custom className for table container */
  className?: string;
  /** Custom row renderer (replaces default row rendering) */
  renderRow?: (row: T, index: number, rowNumber: number) => React.ReactNode;
}

/* =========================================================
   Helpers
   ========================================================= */

function generatePageNumbers(current: number, last: number): (number | string)[] {
  const pages: (number | string)[] = [];
  if (last <= 7) {
    for (let i = 1; i <= last; i++) pages.push(i);
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...');
      pages.push(last);
    } else if (current >= last - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = last - 4; i <= last; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      pages.push(current - 1);
      pages.push(current);
      pages.push(current + 1);
      pages.push('...');
      pages.push(last);
    }
  }
  return pages;
}

function getRowId<T>(row: T, rowIdKey: string, index?: number): number | string {
  const id = (row as Record<string, unknown>)[rowIdKey];
  if (typeof id === 'number' || typeof id === 'string') return id;
  // Fallback to index-based ID (stable across server/client)
  return `row-${index ?? 0}`;
}

/* =========================================================
   Component
   ========================================================= */

export function DataTable<T>({
  title,
  data,
  columns,
  loading = false,
  emptyMessage = 'No data found',
  emptySubMessage = 'Try adjusting your search or filter.',
  emptyIcon,
  showCheckbox = false,
  selectedIds = new Set(),
  onToggleSelectAll,
  onToggleSelectOne,
  rowIdKey = 'id',
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  sortKey,
  sortDir = 'asc',
  onSort,
  filterSlot,
  actions,
  pagination,
  onPageChange,
  onPerPageChange,
  rowClickable = false,
  onRowClick,
  renderRow,
  className,
}: DataTableProps<T>) {
  const allSelected = useMemo(() => {
    if (data.length === 0) return false;
    return data.every((row, idx) => selectedIds.has(getRowId(row, rowIdKey, idx)));
  }, [data, selectedIds, rowIdKey]);

  const someSelected = useMemo(() => {
    return data.some((row, idx) => selectedIds.has(getRowId(row, rowIdKey, idx))) && !allSelected;
  }, [data, selectedIds, allSelected, rowIdKey]);

  const pageNumbers = useMemo(() => {
    if (!pagination) return [];
    return generatePageNumbers(pagination.current_page, pagination.last_page);
  }, [pagination]);

  const sortLabel = useMemo(() => {
    if (!sortKey) return 'Sort';
    const col = columns.find((c) => c.key === sortKey);
    const name = col?.key || sortKey;
    return `${name} ${sortDir === 'asc' ? '↑' : '↓'}`;
  }, [sortKey, sortDir, columns]);

  return (
    <Card className="py-0 gap-0">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 p-5 border-b">
        <h3 className="text-[20px] leading-[1.4] font-semibold text-[#353849]">{title}</h3>
        <div className="flex items-center gap-2">
          {onSearchChange && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="pl-9 w-64"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          )}

          {filterSlot}

          {onSort && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowUpDown className="mr-2 h-4 w-4" /> {sortLabel}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {columns
                  .filter((col) => col.sortable)
                  .map((col) => (
                    <DropdownMenuItem key={col.key} onClick={() => onSort(col.key)}>
                      {col.header}{' '}
                      {sortKey === col.key && (sortDir === 'asc' ? '↑' : '↓')}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {actions}
        </div>
      </div>

      {/* Table Body */}
      <CardContent className={cn('p-0', className)}>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            {emptyIcon && <div className="mb-3 opacity-40">{emptyIcon}</div>}
            <p className="text-sm font-medium">{emptyMessage}</p>
            <p className="text-xs mt-1">{emptySubMessage}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-grey-25">
                  {showCheckbox && onToggleSelectAll && (
                    <TableHead className="w-10 text-[#666D80]">
                      <Checkbox
                        checked={allSelected}
                        data-state={
                          someSelected
                            ? 'indeterminate'
                            : allSelected
                              ? 'checked'
                              : 'unchecked'
                        }
                        onCheckedChange={onToggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(
                        'whitespace-nowrap text-[#666D80]',
                        col.align === 'right' && 'text-right',
                        col.align === 'center' && 'text-center',
                        col.width
                      )}
                    >
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, idx) => {
                  const rowId = getRowId(row, rowIdKey, idx);
                  const checked = selectedIds.has(rowId);
                  const rowNumber = pagination
                    ? (pagination.current_page - 1) * pagination.per_page + idx + 1
                    : idx + 1;

                  if (renderRow) {
                    return renderRow(row, idx, rowNumber);
                  }

                  return (
                    <TableRow
                      key={rowId}
                      className={cn(
                        'group',
                        rowClickable && 'cursor-pointer',
                        checked && 'data-[state=selected]:bg-muted'
                      )}
                      data-selected={checked}
                      onClick={() => onRowClick?.(row)}
                    >
                      {showCheckbox && onToggleSelectOne && (
                        <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => onToggleSelectOne(rowId)}
                            aria-label={`Select row ${rowId}`}
                          />
                        </TableCell>
                      )}
                      {columns.map((col) => {
                        const cellContent = col.render
                          ? col.render(row, idx)
                          : // Default accessor: try row[col.key], fallback to rowNumber for 'no' key
                            col.key === 'no'
                              ? rowNumber
                              : ((row as Record<string, unknown>)[col.key] as React.ReactNode) ?? null;

                        return (
                          <TableCell
                            key={col.key}
                            className={cn(
                              'py-3',
                              col.align === 'right' && 'text-right',
                              col.align === 'center' && 'text-center'
                            )}
                          >
                            {cellContent}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Pagination */}
      {!loading && data.length > 0 && pagination && onPageChange && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t">
          <div className="flex items-center gap-4">
            {onPerPageChange && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  Per page
                </span>
                <Select
                  value={String(pagination.per_page)}
                  onValueChange={(val) => onPerPageChange(Number(val))}
                >
                  <SelectTrigger className="h-8 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50, 100].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              Showing{' '}
              {(pagination.current_page - 1) * pagination.per_page + 1} to{' '}
              {Math.min(
                pagination.current_page * pagination.per_page,
                pagination.total
              )}{' '}
              of {pagination.total} results
            </p>
          </div>
          <Pagination className="mx-0 w-auto">
            <PaginationContent>
              <PaginationItem>
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(pagination.current_page - 1);
                  }}
                  className={
                    pagination.current_page === 1
                      ? 'pointer-events-none opacity-50'
                      : ''
                  }
                  aria-label="Go to previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </PaginationLink>
              </PaginationItem>
              {pageNumbers.map((page, i) =>
                page === '...' ? (
                  <PaginationItem key={`ellipsis-${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={page}>
                    <PaginationLink
                      href="#"
                      isActive={pagination.current_page === page}
                      onClick={(e) => {
                        e.preventDefault();
                        onPageChange(page as number);
                      }}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onPageChange(pagination.current_page + 1);
                  }}
                  className={
                    pagination.current_page === pagination.last_page
                      ? 'pointer-events-none opacity-50'
                      : ''
                  }
                  aria-label="Go to next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </PaginationLink>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </Card>
  );
}

/* =========================================================
   Preset / Convenience Helpers
   ========================================================= */

/**
 * Simple text cell renderer with muted color.
 * Usage: render: textCell('email')
 */
export function textCell<T>(key: string) {
  const TextCell = (row: T) => (
    <span className="text-sm text-muted-foreground">
      {((row as Record<string, unknown>)[key] as React.ReactNode) ?? '-'}
    </span>
  );
  TextCell.displayName = `TextCell(${key})`;
  return TextCell;
}

/**
 * Date formatter cell renderer.
 * Usage: render: dateCell('created_at')
 */
export function dateCell<T>(key: string) {
  const DateCell = (row: T) => {
    const value = (row as Record<string, unknown>)[key];
    return (
      <span className="text-muted-foreground whitespace-nowrap text-sm">
        {formatDate(value)}
      </span>
    );
  };
  DateCell.displayName = `DateCell(${key})`;
  return DateCell;
}

/**
 * Row number cell renderer.
 * Usage: render: numberCell('id')
 */
export function numberCell() {
  // This is handled automatically by the DataTable when col.key === 'no'
  // This helper exists only for explicit usage if needed
  const NumberCell = (_row: unknown, index: number) => (
    <span className="text-muted-foreground text-sm">{index + 1}</span>
  );
  NumberCell.displayName = 'NumberCell';
  return NumberCell;
}
