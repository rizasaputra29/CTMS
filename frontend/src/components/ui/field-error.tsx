import * as React from "react"
import { cn } from "@/lib/utils"

interface FieldErrorProps extends React.ComponentProps<"div"> {
  errors?: Array<{ message?: string } | string | undefined>
}

function FieldError({ className, errors, ...props }: FieldErrorProps) {
  if (!errors || errors.length === 0) return null

  const messages = errors
    .filter((error): error is { message: string } | string =>
      typeof error === "string" || (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string")
    )
    .map((error) => (typeof error === "string" ? error : error.message))
    .filter(Boolean)

  if (messages.length === 0) return null

  return (
    <div
      data-slot="field-error"
      className={cn("text-destructive text-sm", className)}
      {...props}
    >
      {messages.map((message, index) => (
        <p key={index}>{message}</p>
      ))}
    </div>
  )
}

export { FieldError }
