"use client"

import { useRef, useLayoutEffect, useCallback, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { clearCaretPlaceholders, inlineDOMToLaTeX, renderInlineLaTeX } from '../inline'

interface InlineTextProps {
  value?: string
  onChange?: (value: string) => void
  onFocus?: () => void
  onBlur?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  multiline?: boolean
}

export const InlineText = forwardRef<HTMLDivElement, InlineTextProps>(function InlineText(
  {value='',onChange,onFocus,onBlur,onKeyDown,placeholder,className,style,multiline=true},forwardedRef,
) {
  const innerRef = useRef<HTMLDivElement | null>(null)
  const valueRef = useRef<string | null>(null)
  const composing = useRef(false)
  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el || valueRef.current === value || composing.current) return
    valueRef.current = value
    el.replaceChildren(renderInlineLaTeX(value))
  },[value])
  const handleInput = useCallback(() => {
    if (!innerRef.current || composing.current) return
    clearCaretPlaceholders(innerRef.current)
    const next = inlineDOMToLaTeX(innerRef.current)
    valueRef.current = next
    onChange?.(next)
  },[onChange])
  return <div
    ref={node => { innerRef.current = node; if (typeof forwardedRef === 'function') forwardedRef(node); else if (forwardedRef) forwardedRef.current = node }}
    contentEditable suppressContentEditableWarning data-latex-editor="true" role="textbox" aria-multiline={multiline} aria-label={placeholder || 'Editable text'}
    onInput={handleInput}
    onCompositionStart={() => { composing.current = true }}
    onCompositionEnd={() => { composing.current = false; handleInput() }}
    onFocus={onFocus} onBlur={onBlur}
    onKeyDown={event => { onKeyDown?.(event); if (!multiline && event.key === 'Enter' && !event.defaultPrevented) event.preventDefault() }}
    onClick={event => { if ((event.target as Element).closest('a')) event.preventDefault() }}
    onPaste={event => {
      event.preventDefault()
      const selection = window.getSelection()
      if (!selection?.rangeCount) return
      const range = selection.getRangeAt(0); range.deleteContents()
      const node = document.createTextNode(event.clipboardData.getData('text/plain'))
      range.insertNode(node); range.setStartAfter(node); range.collapse(true)
      selection.removeAllRanges(); selection.addRange(range); handleInput()
    }}
    className={cn('block min-h-[1.5em] w-full outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-[var(--visual-editor-text-dim)] [&_a]:text-[var(--primary)] [&_a]:underline [&_code]:font-mono',className)}
    data-placeholder={placeholder} style={{whiteSpace:multiline ? 'pre-wrap' : 'nowrap',...style}}
  />
})
