"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

export interface RoleOption {
  label: string
  value: string
}

interface MultiRoleSelectProps {
  options: RoleOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
}

export function MultiRoleSelect({
  options,
  value,
  onChange,
  placeholder = "Select roles...",
}: MultiRoleSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  const removeOption = (e: React.MouseEvent, optionValue: string) => {
    e.stopPropagation()
    onChange(value.filter((v) => v !== optionValue))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(!open)
    }
  }

  const selectedOptions = options.filter((o) => value.includes(o.value))

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger - Using div with role="button" instead of button element to avoid nested button issue */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen(!open)}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex w-full min-h-10 items-center gap-1.5 rounded-md border bg-grey-25 px-3 py-2 text-sm transition-colors cursor-pointer",
          open
            ? "border-primary-300 ring-1 ring-primary-300"
            : "border-grey-100 hover:border-grey-200"
        )}
      >
        <div className="flex flex-1 flex-wrap items-center gap-1">
          {selectedOptions.length === 0 && (
            <span className="text-grey-300">{placeholder}</span>
          )}
          {selectedOptions.map((option) => (
            <span
              key={option.value}
              className="inline-flex items-center gap-1 rounded-md bg-warning-25 px-2 py-0.5 text-xs font-medium text-warning-200"
            >
              {option.label}
              <button
                type="button"
                onClick={(e) => removeOption(e, option.value)}
                className="inline-flex size-3.5 items-center justify-center rounded-sm text-warning-200 hover:text-warning-300"
                aria-label={`Remove ${option.label}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-grey-400 transition-transform",
            open && "rotate-180"
          )}
        />
      </div>

      {open && (
        <div 
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-grey-100 bg-card p-1 shadow-medium"
        >
          {options.map((option) => {
            const isSelected = value.includes(option.value)
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggleOption(option.value)}
                className="flex w-full items-center gap-3 rounded-sm px-2 py-2 text-sm text-grey-600 hover:bg-accent transition-colors"
              >
                <Checkbox
                  checked={isSelected}
                  className="pointer-events-none size-4"
                />
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
