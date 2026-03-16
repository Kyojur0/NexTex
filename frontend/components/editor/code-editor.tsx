"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@/lib/utils"

interface CodeEditorProps {
  content: string
  onChange: (content: string) => void
  fileName: string
  fontSize?: number
}

// Simple LaTeX syntax highlighting
function highlightLatex(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let remaining = line
  let key = 0

  while (remaining.length > 0) {
    // Comments
    if (remaining.startsWith("%")) {
      parts.push(
        <span key={key++} className="text-[var(--syntax-comment)] italic">
          {remaining}
        </span>
      )
      break
    }

    // Commands
    const commandMatch = remaining.match(/^(\\[a-zA-Z]+)/)
    if (commandMatch) {
      parts.push(
        <span key={key++} className="text-[var(--syntax-command)] font-medium">
          {commandMatch[1]}
        </span>
      )
      remaining = remaining.slice(commandMatch[1].length)
      continue
    }

    // Braces
    if (remaining[0] === "{" || remaining[0] === "}") {
      parts.push(
        <span key={key++} className="text-[var(--syntax-bracket)]">
          {remaining[0]}
        </span>
      )
      remaining = remaining.slice(1)
      continue
    }

    // Brackets
    if (remaining[0] === "[" || remaining[0] === "]") {
      parts.push(
        <span key={key++} className="text-[var(--syntax-bracket)] opacity-70">
          {remaining[0]}
        </span>
      )
      remaining = remaining.slice(1)
      continue
    }

    // Math delimiters
    if (remaining[0] === "$") {
      parts.push(
        <span key={key++} className="text-[var(--syntax-keyword)]">
          {remaining[0]}
        </span>
      )
      remaining = remaining.slice(1)
      continue
    }

    // Regular text - collect until special character
    const textMatch = remaining.match(/^[^\\{}[\]$%]+/)
    if (textMatch) {
      parts.push(<span key={key++}>{textMatch[0]}</span>)
      remaining = remaining.slice(textMatch[0].length)
      continue
    }

    // Fallback: single character
    parts.push(<span key={key++}>{remaining[0]}</span>)
    remaining = remaining.slice(1)
  }

  return parts
}

export function CodeEditor({
  content,
  onChange,
  fileName,
  fontSize = 14,
}: CodeEditorProps) {
  const [cursorLine, setCursorLine] = useState(1)
  const [cursorColumn, setCursorColumn] = useState(1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lines = content.split("\n")

  const updateCursorPosition = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const text = textarea.value
    const selectionStart = textarea.selectionStart
    const textBeforeCursor = text.substring(0, selectionStart)
    const linesBeforeCursor = textBeforeCursor.split("\n")
    const line = linesBeforeCursor.length
    const column = linesBeforeCursor[linesBeforeCursor.length - 1].length + 1

    setCursorLine(line)
    setCursorColumn(column)
  }, [])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.addEventListener("click", updateCursorPosition)
    textarea.addEventListener("keyup", updateCursorPosition)

    return () => {
      textarea.removeEventListener("click", updateCursorPosition)
      textarea.removeEventListener("keyup", updateCursorPosition)
    }
  }, [updateCursorPosition])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget

    // Tab handling
    if (e.key === "Tab") {
      e.preventDefault()
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newContent =
        content.substring(0, start) + "  " + content.substring(end)
      onChange(newContent)
      // Set cursor position after tab
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
    }

    // Auto-closing brackets
    const pairs: Record<string, string> = {
      "{": "}",
      "[": "]",
      "(": ")",
    }

    if (pairs[e.key]) {
      e.preventDefault()
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const selectedText = content.substring(start, end)
      const newContent =
        content.substring(0, start) +
        e.key +
        selectedText +
        pairs[e.key] +
        content.substring(end)
      onChange(newContent)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1
      }, 0)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--editor-bg)]">
      {/* Tab bar */}
      <div className="h-9 flex items-center border-b border-border bg-background px-2">
        <div className="flex items-center gap-2 h-7 px-3 bg-accent/50 rounded-t text-sm">
          <span className="truncate max-w-40">{fileName}</span>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Line numbers */}
        <div
          className="flex-shrink-0 py-3 pr-3 text-right select-none bg-[var(--editor-gutter)] border-r border-border"
          style={{ fontSize, lineHeight: "1.5" }}
        >
          {lines.map((_, i) => (
            <div
              key={i}
              className={cn(
                "px-3 text-[var(--editor-line-number)]",
                cursorLine === i + 1 && "text-foreground"
              )}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code display (highlighted) */}
        <div className="flex-1 relative">
          <div
            className="absolute inset-0 py-3 px-4 font-mono pointer-events-none overflow-hidden whitespace-pre"
            style={{ fontSize, lineHeight: "1.5" }}
          >
            {lines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "min-h-[1.5em]",
                  cursorLine === i + 1 && "bg-accent/30"
                )}
              >
                {highlightLatex(line)}
              </div>
            ))}
          </div>

          {/* Actual textarea (transparent) */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="absolute inset-0 py-3 px-4 font-mono resize-none bg-transparent text-transparent caret-foreground outline-none selection:bg-[var(--editor-selection)] selection:text-transparent scrollbar-thin"
            style={{ fontSize, lineHeight: "1.5" }}
            spellCheck={false}
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="h-6 flex items-center justify-between px-3 border-t border-border bg-background text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>LaTeX</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-4">
          <span>
            Ln {cursorLine}, Col {cursorColumn}
          </span>
          <span>{lines.length} lines</span>
        </div>
      </div>
    </div>
  )
}
