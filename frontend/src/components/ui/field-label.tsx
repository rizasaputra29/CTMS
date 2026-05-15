import * as React from "react"
import { cn } from "@/lib/utils"

function FieldLabel({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"label"> & {
  variant?: "default" | "label"
}) {
  return (
    <label
      data-slot="field-label"
      data-variant={variant}
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        variant === "label" && "text-foreground font-semibold",
        className
      )}
      {...props}
    />
  )
}

export { FieldLabel }
