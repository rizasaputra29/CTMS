/**
 * Typed helper functions for Badge variants
 * Replaces inline `as const` assertions with type-safe functions
 */

import { badgeVariants } from '@/components/ui/badge';
import { type VariantProps } from 'class-variance-authority';

// Extract the variant type from badgeVariants
export type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];
export type StatusBadgeVariant = NonNullable<BadgeVariant>;

/**
 * Get badge variant for user role
 */
export function getRoleBadgeVariant(roleSlug: string): NonNullable<BadgeVariant> {
  switch (roleSlug) {
    case 'admin':
      return 'roleAdmin';
    case 'dosen':
      return 'roleDosen';
    case 'mahasiswa':
      return 'roleMahasiswa';
    default:
      return 'outline';
  }
}
export function getTaDefenseStatusBadgeVariant(status: string): NonNullable<BadgeVariant> {
  switch (status) {
    case 'SCHEDULED':
      return 'default';
    case 'DONE':
      return 'default';
    case 'CANCELLED':
      return 'secondary';
    default:
      return 'outline';
  }
}

/**
 * Get badge variant for SEMPRO schedule status
 */
export function getSemproStatusBadgeVariant(status: string): NonNullable<BadgeVariant> {
  switch (status) {
    case 'COMPLETED':
      return 'default';
    case 'CANCELLED':
      return 'destructive';
    case 'PENDING_APPROVAL':
      return 'secondary';
    case 'APPROVED':
      return 'default';
    default:
      return 'secondary';
  }
}

/**
 * Get badge variant for group status
 * Uses color-coded variants matching the design system
 */
export function getGroupStatusBadgeVariant(status: string): NonNullable<BadgeVariant> {
  switch (status) {
    case 'APPROVED':
    case 'KELOMPOK_FINAL':
      return 'statusApproved';
    case 'REJECTED':
      return 'statusRejected';
    case 'PENDING':
      return 'statusPending';
    case 'FORMING':
    case 'FORMING_SOLO':
      return 'statusForming';
    case 'READY_FOR_BIDDING':
    case 'READY_FOR_FINALIZATION':
      return 'statusReady';
    case 'CLOSED':
      return 'statusClosed';
    default:
      return 'secondary';
  }
}

/**
 * Get badge variant for bidding/proposal status
 */
export function getBidStatusBadgeVariant(status: string): NonNullable<BadgeVariant> {
  switch (status) {
    case 'ACCEPTED':
    case 'APPROVED':
      return 'default';
    case 'REJECTED':
      return 'destructive';
    default:
      return 'secondary';
  }
}

/**
 * Get badge variant for proposal supervisor approval status
 * Alias for getBidStatusBadgeVariant with same logic
 */
export function getProposalStatusBadgeVariant(status: string): NonNullable<BadgeVariant> {
  return getBidStatusBadgeVariant(status);
}

/**
 * Get badge variant for supervisor approval status on group detail
 */
export function getSupervisorApprovalBadgeVariant(status: string): NonNullable<BadgeVariant> {
  switch (status) {
    case 'APPROVED':
      return 'supervisorApproved';
    case 'PENDING':
      return 'supervisorPending';
    default:
      return 'supervisorPending';
  }
}
