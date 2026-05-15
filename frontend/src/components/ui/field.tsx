import * as React from "react"
import { cn } from "@/lib/utils"

function Field({
  className,
  orientation = "vertical",
  "data-invalid": dataInvalid,
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "vertical" | "horizontal" | "responsive"
  "data-invalid"?: boolean
}) {
  return (
    <div
      data-slot="field"
      data-invalid={dataInvalid}
      className={cn(
        "grid gap-2",
        orientation === "horizontal" &&
          "grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1",
        orientation === "responsive" &&
          "sm:grid-cols-[1fr_auto] sm:items-center sm:gap-x-4 sm:gap-y-1",
        className
      )}
      {...props}
    />
  )
}

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="field-label"
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
}

function FieldError({ className, children, ...props }: React.ComponentProps<"p">) {
  if (!children) return null
  
  return (
    <p
      data-slot="field-error"
      className={cn("text-sm text-destructive", className)}
      {...props}
    >
      {children}
    </p>
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="fieldset"
      className={cn("grid gap-6", className)}
      {...props}
    />
  )
}

function FieldLegend({ className, ...props }: React.ComponentProps<"legend">) {
  return (
    <legend
      data-slot="fieldset-legend"
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-title"
      className={cn("text-base font-medium", className)}
      {...props}
    />
  )
}

export {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
  FieldSet,
  FieldLegend,
  FieldGroup,
  FieldContent,
  FieldTitle,
}
