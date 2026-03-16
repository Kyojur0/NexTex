"use client"

import { memo, useRef, useEffect, useCallback, useState } from "react"
import { cn } from "@/lib/utils"

interface SmoothCodeEditorProps {
  content: string
  onChange: (content: string) => void
  fileName: string
  fontSize?: number
  tabSize?: number
}

// Memoized line highlighting for performance
const LineHighlight = memo(function LineHighlight({
  line,
  number,
}: {
  line: string
  number: number
}) {
  return (
    <div className="flex">
      <div className="w-12 text-right pr-4 text-xs text-muted-foreground bg-muted/30 select-none">
        {number}
      </div>
      <div className="flex-1 font-mono text-sm">{line || "\n"}</div>
    </div>
  )
})

export const SmoothCodeEditor = memo(function SmoothCodeEditor({
  content,
  onChange,
  fileName,
  fontSize = 14,
  tabSize = 2,
}: SmoothCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [, setUpdateTrigger] = useState(0)

  // Handle tab key
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const tab = " ".repeat(tabSize)

      const newContent =
        content.substring(0, start) + tab + content.substring(end)

      onChange(newContent)

      // Move cursor after inserted tab
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + tabSize
      }, 0)
    }

    // Handle Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault()
      // Save will be handled by parent component
    }
  }, [content, onChange, tabSize])

  // Handle text changes
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }, [onChange])

  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const textarea = e.target as HTMLTextAreaElement
    if (containerRef.current) {
      const lineNumbers = containerRef.current.querySelector('[data-line-numbers]') as HTMLElement
      if (lineNumbers) {
        lineNumbers.scrollTop = textarea.scrollTop
      }
    }
  }, [])

  const lines = content.split('\n')

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-editor-bg border border-border rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="h-9 border-b border-border bg-muted/30 px-4 flex items-center">
        <span className="text-xs font-medium text-muted-foreground">{fileName}</span>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Line Numbers - Hidden Overflow */}
        <div
          data-line-numbers
          className="overflow-hidden bg-muted/20"
          style={{ fontSize: `${fontSize}px` }}
        >
          {lines.map((line, i) => (
            <div
              key={i}
              className="h-[1.5em] flex items-center text-right pr-4 text-xs text-muted-foreground select-none"
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea - Actual Editor */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          className={cn(
            "flex-1 bg-transparent text-editor-cursor font-mono p-4 resize-none outline-none",
            "scrollbar-thin placeholder-muted-foreground/50",
            "whitespace-pre-wrap break-words"
          )}
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: "1.5em",
            tabSize: tabSize,
          }}
          spellCheck="false"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      {/* Status Bar */}
      <div className="h-7 border-t border-border bg-muted/20 px-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{lines.length} lines</span>
        <span>{content.length} characters</span>
      </div>
    </div>
  )
})
