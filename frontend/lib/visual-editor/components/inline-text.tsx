"use client"

import { useRef, useEffect, useCallback, forwardRef } from "react"
import { cn } from "@/lib/utils"

interface InlineTextProps {
  value: string
  onChange: (value: string) => void
  onFocus?: () => void
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  placeholder?: string
  className?: string
  multiline?: boolean
}

export const InlineText = forwardRef<HTMLDivElement, InlineTextProps>(
  function InlineText(
    { value, onChange, onFocus, onBlur, onKeyDown, placeholder, className, multiline = true },
    forwardedRef
  ) {
    const innerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (forwardedRef) {
        if (typeof forwardedRef === "function") {
          forwardedRef(innerRef.current)
        } else {
          forwardedRef.current = innerRef.current
        }
      }
    }, [forwardedRef])

    // Sync initial value and external changes only when not focused.
    useEffect(() => {
      const el = innerRef.current
      if (!el || document.activeElement === el) return
      if (el.innerText !== value) {
        el.innerText = value
      }
    }, [value])

    const handleInput = useCallback(() => {
      const el = innerRef.current
      if (!el) return
      const text = el.innerText
      if (text !== value) {
        onChange(text)
      }
    }, [onChange, value])

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault()
          return
        }
        onKeyDown?.(e)
      },
      [onKeyDown, multiline]
    )

    return (
      <div
        ref={innerRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        className={cn(
          "block min-h-[1.5em] w-full outline-none",
          "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:cursor-text",
          className
        )}
        data-placeholder={placeholder}
        style={{ whiteSpace: multiline ? "pre-wrap" : "nowrap" }}
      >
        {value}
      </div>
    )
  }
)
