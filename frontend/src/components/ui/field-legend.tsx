import * as React from "react"
import { cn } from "@/lib/utils"

function FieldLegend({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"legend"> & {
  variant?: "default" | "label"
}) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "text-sm font-medium",
        variant === "label" && "text-foreground font-semibold",
        className
      )}
      {...props}
    />
  )
}

export { FieldLegend }
