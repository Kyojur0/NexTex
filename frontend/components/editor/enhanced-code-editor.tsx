"use client"

import { memo, useRef, useEffect, useCallback, useState } from "react"
import { tokenizeLaTeX, getTokenColor } from "@/lib/syntax-highlighter"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

interface EnhancedCodeEditorProps {
  content: string
  onChange: (content: string) => void
  fileName: string
  fontSize?: number
  tabSize?: number
  enableSyntaxHighlight?: boolean
}

export const EnhancedCodeEditor = memo(function EnhancedCodeEditor({
  content,
  onChange,
  fileName,
  fontSize = 14,
  tabSize = 2,
  enableSyntaxHighlight = false,
}: EnhancedCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
  }, [content, onChange, tabSize])

  // Handle text changes
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }, [onChange])

  // Sync scroll between textarea and highlights
  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const textarea = e.target as HTMLTextAreaElement
    if (highlightRef.current) {
      highlightRef.current.scrollTop = textarea.scrollTop
      highlightRef.current.scrollLeft = textarea.scrollLeft
    }
    if (containerRef.current?.querySelector('[data-line-numbers]')) {
      const lineNumbers = containerRef.current.querySelector('[data-line-numbers]') as HTMLElement
      lineNumbers.scrollTop = textarea.scrollTop
    }
  }, [])

  const lines = content.split('\n')
  const tokens = enableSyntaxHighlight && mounted ? tokenizeLaTeX(content) : []
  const isDark = mounted && theme === 'dark'

  // Build highlighted content by line
  const highlightedLines = lines.map((line) => {
    if (!enableSyntaxHighlight || !mounted) return line

    let lineTokens: typeof tokens = []
    let lineStart = 0

    // Find tokens for this line
    for (const token of tokens) {
      const tokenLineStart = content.slice(0, token.start).split('\n').length - 1
      const tokenLineEnd = content.slice(0, token.end).split('\n').length - 1
      const currentLineNumber = lines.slice(0, lines.indexOf(line)).length

      if (tokenLineStart === currentLineNumber) {
        lineTokens.push(token)
      }
    }

    return lineTokens
  })

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
        {/* Line Numbers */}
        <div
          data-line-numbers
          className="overflow-hidden bg-muted/20 select-none"
          style={{ fontSize: `${fontSize}px` }}
        >
          {lines.map((_, i) => (
            <div
              key={i}
              className="h-[1.5em] flex items-center justify-end pr-4 text-xs text-muted-foreground border-r border-border/30"
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Highlight Layer (visible only for syntax highlighting) */}
        {enableSyntaxHighlight && mounted && (
          <div
            ref={highlightRef}
            className="absolute inset-0 pointer-events-none overflow-hidden font-mono text-sm p-4"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: "1.5em",
              whiteSpace: "pre-wrap",
              wordBreak: "break-words",
              color: "transparent",
            }}
          >
            {lines.map((line, lineIdx) => (
              <div key={lineIdx} style={{ height: "1.5em" }}>
                {enableSyntaxHighlight && mounted ? (
                  line.split('').map((char, idx) => {
                    const absolutePos = content.split('\n').slice(0, lineIdx).join('\n').length + lineIdx + idx
                    const token = tokens.find(t => t.start <= absolutePos && t.end > absolutePos)
                    return (
                      <span
                        key={idx}
                        className={token ? getTokenColor(token.type, isDark) : "text-foreground"}
                      >
                        {char}
                      </span>
                    )
                  })
                ) : (
                  line
                )}
              </div>
            ))}
          </div>
        )}

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
            enableSyntaxHighlight && mounted ? "bg-transparent/50 text-transparent caret-editor-cursor" : "",
            "whitespace-pre-wrap break-words"
          )}
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: "1.5em",
            tabSize: tabSize,
            caretColor: enableSyntaxHighlight && mounted ? "var(--editor-cursor)" : "auto",
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
