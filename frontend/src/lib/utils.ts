import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a date value to ISO-style string (YYYY-MM-DD).
 * Returns '-' if the value is null/undefined/invalid.
 * Uses UTC to avoid timezone-based hydration mismatches.
 */
export function formatDate(value: unknown): string {
  if (!value) return '-';
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return '-';
  return d.toISOString().slice(0, 10);
}

/**
 * Format a date value to ISO-style datetime string (YYYY-MM-DD HH:mm).
 * Returns '-' if the value is null/undefined/invalid.
 */
export function formatDateTime(value: unknown): string {
  if (!value) return '-';
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return '-';
  const iso = d.toISOString();
  return iso.slice(0, 10) + ' ' + iso.slice(11, 16);
}
