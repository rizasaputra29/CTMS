"use client";

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type AvatarProps = React.ComponentProps<typeof Avatar>;

const AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-700 border-emerald-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-violet-100 text-violet-700 border-violet-200",
  "bg-amber-100 text-amber-700 border-amber-200",
  "bg-rose-100 text-rose-700 border-rose-200",
  "bg-indigo-100 text-indigo-700 border-indigo-200",
  "bg-teal-100 text-teal-700 border-teal-200",
  "bg-orange-100 text-orange-700 border-orange-200",
] as const;

function generateInitials(name: string): string {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (
    parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

function avatarColorClass(name: string): string {
  if (!name || typeof name !== 'string') return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

interface AvatarWithInitialsProps extends Omit<AvatarProps, "size"> {
  name: string;
  size?: "sm" | "default" | "lg";
  className?: string;
  fallbackClassName?: string;
}

export function AvatarWithInitials({
  name,
  size = "default",
  className,
  fallbackClassName,
  ...props
}: AvatarWithInitialsProps) {
  const colorClass = avatarColorClass(name);

  return (
    <Avatar size={size} className={cn("border", colorClass, className)} {...props}>
      <AvatarFallback
        className={cn(
          colorClass,
          "font-semibold text-xs flex items-center justify-center",
          fallbackClassName
        )}
      >
        {generateInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export { generateInitials, avatarColorClass };
export type { AvatarWithInitialsProps };
