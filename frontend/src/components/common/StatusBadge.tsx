"use client";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { type VariantProps } from "class-variance-authority";
import {
  getRoleBadgeVariant,
  getGroupStatusBadgeVariant,
  getBidStatusBadgeVariant,
  getSemproStatusBadgeVariant,
  getTaDefenseStatusBadgeVariant,
  getProposalStatusBadgeVariant,
  type StatusBadgeVariant,
} from "@/lib/badge-variants";
import { cn } from "@/lib/utils";

type StatusCategory =
  | "role"
  | "group"
  | "bid"
  | "proposal"
  | "sempro"
  | "ta-defense"
  | "custom";

export interface StatusBadgeProps
  extends Omit<
    React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>,
    "variant" | "color"
  > {
  status: string;
  category?: StatusCategory;
  /**
   * Optional custom resolver. Takes precedence when category is "custom".
   */
  resolver?: (status: string) => StatusBadgeVariant;
}

const defaultResolvers: Record<
  Exclude<StatusCategory, "custom">,
  (status: string) => StatusBadgeVariant
> = {
  role: getRoleBadgeVariant,
  group: getGroupStatusBadgeVariant,
  bid: getBidStatusBadgeVariant,
  proposal: getProposalStatusBadgeVariant,
  sempro: getSemproStatusBadgeVariant,
  "ta-defense": getTaDefenseStatusBadgeVariant,
};

/**
 * Type-safe status badge that maps status strings to the project's
 * design-system badge variants. Use this instead of inline Tailwind
 * color maps.
 */
export function StatusBadge({
  status,
  category = "group",
  resolver,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const resolve = category === "custom" ? resolver : defaultResolvers[category];
  const variant = resolve?.(status) ?? "secondary";

  return (
    <Badge variant={variant} className={cn(className)} {...props}>
      {children ?? status}
    </Badge>
  );
}
