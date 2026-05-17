import * as React from "react"
import { cn } from "@/lib/utils"

function FieldTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-title"
      className={cn("text-sm font-medium leading-none", className)}
      {...props}
    />
  )
}

export { FieldTitle }
