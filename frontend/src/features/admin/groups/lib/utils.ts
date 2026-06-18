import type { Group, PeriodOption } from "../types";
import { formatDate as baseFormatDate } from "@/lib/utils";

export function getStatusLabel(status: string, statusLabel?: string): string {
  const labels: Record<string, string> = {
    APPROVED: "Approved",
    READY_FOR_BIDDING: "Ready for Bidding",
    FORMING: "Forming",
    FORMING_SOLO: "Solo Forming",
    READY_FOR_FINALIZATION: "Ready for Finalization",
    KELOMPOK_FINAL: "Kelompok Final",
    REJECTED: "Rejected",
  };
  return labels[status] || statusLabel || status;
}

export const reasonMap: Record<string, string> = {
  PERIOD_FINALIZED: "Periode sudah difinalisasi.",
};

export function canDeleteGroup(
  group: Group,
  periods: PeriodOption[]
): boolean {
  const period = periods.find((p) => p.id === group.period_id);
  if (!period) return true;
  if (!period.is_active) return true;
  if (["FORMING", "FORMING_SOLO"].includes(group.status)) return true;
  return false;
}

export function formatDate(dateString?: string): string {
  if (!dateString) return "-";
  return baseFormatDate(dateString);
}
