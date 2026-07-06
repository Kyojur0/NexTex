"use client"

import { useRef, useEffect, useLayoutEffect, useCallback, forwardRef } from "react"
import { cn } from "@/lib/utils"

interface InlineTextProps {
  value?: string
  onChange?: (value: string) => void
  onFocus?: () => void
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  placeholder?: string
  className?: string
  multiline?: boolean
}

export const InlineText = forwardRef<HTMLDivElement, InlineTextProps>(
  function InlineText(
    { value = "", onChange, onFocus, onBlur, onKeyDown, placeholder, className, multiline = true },
    forwardedRef
  ) {
    const innerRef = useRef<HTMLDivElement>(null)
    const valueRef = useRef(value)

    useEffect(() => {
      if (forwardedRef) {
        if (typeof forwardedRef === "function") {
          forwardedRef(innerRef.current)
        } else {
          forwardedRef.current = innerRef.current
        }
      }
    }, [forwardedRef])

    // Initialise the contentEditable text content synchronously on mount.
    useLayoutEffect(() => {
      const el = innerRef.current
      if (!el) return
      valueRef.current = value
      el.textContent = value
    }, [])

    // Sync external value changes only when not focused to avoid cursor jumps.
    useEffect(() => {
      const el = innerRef.current
      if (!el || document.activeElement === el) return
      if (valueRef.current === value) return
      valueRef.current = value
      el.textContent = value
    }, [value])

    const handleInput = useCallback(() => {
      const el = innerRef.current
      if (!el) return
      const next = el.innerText
      valueRef.current = next
      onChange?.(next)
    }, [onChange])

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
          "empty:before:content-[attr(data-placeholder)] empty:before:text-[var(--visual-editor-text-dim)] empty:before:cursor-text",
          className
        )}
        data-placeholder={placeholder}
        style={{ whiteSpace: multiline ? "pre-wrap" : "nowrap" }}
      />
    )
  }
)
