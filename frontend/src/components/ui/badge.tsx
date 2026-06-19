import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
        roleAdmin:
          "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
        roleDosen:
          "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
        roleMahasiswa:
          "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
        statusApproved:
          "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
        statusRejected:
          "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
        statusPending:
          "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        statusForming:
          "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
        statusReady:
          "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
        statusClosed:
          "bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-300",
        supervisorApproved:
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        supervisorPending:
          "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
