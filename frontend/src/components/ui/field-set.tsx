import * as React from "react"
import { cn } from "@/lib/utils"

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn("grid gap-4", className)}
      {...props}
    />
  )
}

export { FieldSet }
