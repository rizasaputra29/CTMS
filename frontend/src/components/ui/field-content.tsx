import * as React from "react"
import { cn } from "@/lib/utils"

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn("grid gap-1.5", className)}
      {...props}
    />
  )
}

export { FieldContent }
