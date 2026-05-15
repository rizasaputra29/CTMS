/**
 * Component Props Type Definitions
 * Shared component prop interfaces
 */

import type { ReactNode, ElementType } from 'react';

/**
 * Base component props
 */
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

/**
 * Dialog component props
 */
export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

/**
 * Form dialog props
 */
export interface FormDialogProps<T = Record<string, unknown>> extends DialogProps {
  data?: T;
  onSubmit: (data: T) => Promise<void>;
  loading?: boolean;
}

/**
 * Table column definition
 */
export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  header: string;
  accessor: (row: T) => unknown;
  sortable?: boolean;
  width?: string;
  cell?: (value: unknown, row: T) => ReactNode;
}

/**
 * Table props
 */
export interface TableProps<T = Record<string, unknown>> {
  data: T[];
  columns: TableColumn<T>[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  keyExtractor: (row: T) => string | number;
  emptyMessage?: string;
}

/**
 * Pagination props
 */
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
}

/**
 * Filter panel props
 */
export interface FilterPanelProps {
  filters: Record<string, unknown>;
  onFilterChange: (filters: Record<string, unknown>) => void;
  loading?: boolean;
}

/**
 * Search input props
 */
export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
}

/**
 * Card props
 */
export interface CardProps extends BaseComponentProps {
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
  headerAction?: ReactNode;
}

/**
 * Stats card props
 */
export interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ElementType;
  trend?: {
    value: string;
    positive: boolean;
  };
  className?: string;
}

/**
 * Select option
 */
export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

/**
 * Select input props
 */
export interface SelectInputProps {
  options: SelectOption[];
  value: string | number | null;
  onChange: (value: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Date range picker props
 */
export interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (range: { start: Date | null; end: Date | null }) => void;
}

/**
 * Confirm dialog props
 */
export interface ConfirmDialogProps extends DialogProps {
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  destructive?: boolean;
  loading?: boolean;
}

/**
 * Loading state
 */
export interface LoadingState {
  loading: boolean;
  error: string | null;
}

/**
 * Async action state
 */
export interface AsyncActionState {
  loading: boolean;
  error: string | null;
  success: boolean;
}

/**
 * Form field props
 */
export interface FormFieldProps {
  name: string;
  label?: string;
  required?: boolean;
  error?: string;
  helpText?: string;
}

/**
 * List item props
 */
export interface ListItemProps {
  id: string | number;
  label: string;
  subtitle?: string;
  icon?: ElementType;
  action?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}
