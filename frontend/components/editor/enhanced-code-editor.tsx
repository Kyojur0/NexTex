"use client"

import { memo, useRef, useEffect, useCallback, useState, useMemo, useDeferredValue } from "react"
import { tokenizeLaTeX, getTokenColor, Token } from "@/lib/syntax-highlighter"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { Sparkles } from "lucide-react"

interface EnhancedCodeEditorProps {
  content: string
  onChange: (content: string) => void
  fileName: string
  fontSize?: number
  tabSize?: number
  enableSyntaxHighlight?: boolean
  wordWrap?: boolean
  onAISpotlight?: () => void
  errorLines?: Array<{ line: number; message: string; context: string; severity: string }>
}

export const EnhancedCodeEditor = memo(function EnhancedCodeEditor({
  content,
  onChange,
  fileName,
  fontSize = 14,
  tabSize = 2,
  enableSyntaxHighlight = false,
  wordWrap = true,
  onAISpotlight,
  errorLines = [],
}: EnhancedCodeEditorProps) {
  const MAX_HIGHLIGHT_CHARS = 40000
  const MAX_HIGHLIGHT_LINES = 1200
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Listen for jump-to-line events from the terminal
  useEffect(() => {
    const handler = (e: CustomEvent<{ line: number }>) => {
      if (textareaRef.current) {
        const lines = content.split("\n")
        const targetLine = Math.max(0, e.detail.line - 1)
        const charOffset = lines.slice(0, targetLine).join("\n").length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(charOffset, charOffset + (lines[targetLine]?.length || 0))
        const lineHeight = fontSize * 1.5
        textareaRef.current.scrollTop = targetLine * lineHeight - 80
      }
    }
    window.addEventListener("editor:jump-to-line", handler as EventListener)
    return () => window.removeEventListener("editor:jump-to-line", handler as EventListener)
  }, [content, fontSize])

  // Handle tab key
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const tab = " ".repeat(tabSize)
      const newContent = content.substring(0, start) + tab + content.substring(end)
      onChange(newContent)
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
    const lineNumbers = containerRef.current?.querySelector("[data-line-numbers]") as HTMLElement | null
    if (lineNumbers) {
      lineNumbers.scrollTop = textarea.scrollTop
    }
  }, [])

  // -----------------------------------------------------------------------
  // Performance-critical: memoize all derived structures
  // -----------------------------------------------------------------------

  const lines = useMemo(() => content.split("\n"), [content])
  const deferredContent = useDeferredValue(content)
  const deferredLines = useMemo(() => deferredContent.split("\n"), [deferredContent])
  const canHighlight =
    enableSyntaxHighlight &&
    mounted &&
    deferredContent.length <= MAX_HIGHLIGHT_CHARS &&
    deferredLines.length <= MAX_HIGHLIGHT_LINES

  const lineOffsets = useMemo(() => {
    const offsets: number[] = []
    let offset = 0
    for (const line of deferredLines) {
      offsets.push(offset)
      offset += line.length + 1 // +1 for newline char
    }
    return offsets
  }, [deferredLines])

  const tokens = useMemo(() => {
    if (!canHighlight) return []
    return tokenizeLaTeX(deferredContent)
  }, [canHighlight, deferredContent])

  const isDark = mounted && theme === "dark"

  // Memoize line numbers — highlight error lines in red
  const lineNumbers = useMemo(() => {
    const errorLineSet = new Set(errorLines.map((e) => e.line))
    return lines.map((_, i) => {
      const hasError = errorLineSet.has(i + 1)
      return (
        <div
          key={i}
          className={cn(
            "h-[1.5em] flex items-center justify-end pr-3 text-xs border-r transition-colors relative",
            hasError
              ? "text-white bg-destructive/80 border-destructive font-bold"
              : "text-muted-foreground border-border/30"
          )}
          title={hasError ? errorLines.find((e) => e.line === i + 1)?.message : undefined}
        >
          {hasError && <span className="absolute left-1 w-1.5 h-1.5 rounded-full bg-white" />}
          {i + 1}
        </div>
      )
    })
  }, [lines.length, errorLines])

  // Memoize highlighted content — groups consecutive same-token chars into single spans
  const highlightedContent = useMemo(() => {
    if (!canHighlight) return null

    let tokenIdx = 0
    return deferredLines.map((line, lineIdx) => {
      const lineStart = lineOffsets[lineIdx]
      const spans: React.ReactElement[] = []
      let currentClass = ""
      let currentText = ""
      while (tokenIdx < tokens.length && tokens[tokenIdx].end <= lineStart) tokenIdx++

      for (let i = 0; i < line.length; i++) {
        const absPos = lineStart + i
        while (tokenIdx < tokens.length && tokens[tokenIdx].end <= absPos) tokenIdx++
        const activeToken: Token | null =
          tokenIdx < tokens.length &&
          tokens[tokenIdx].start <= absPos &&
          tokens[tokenIdx].end > absPos
            ? tokens[tokenIdx]
            : null
        const cls = activeToken ? getTokenColor(activeToken.type, isDark) : "text-foreground"

        if (cls === currentClass) {
          currentText += line[i]
        } else {
          if (currentText) {
            spans.push(
              <span key={spans.length} className={currentClass}>
                {currentText}
              </span>
            )
          }
          currentClass = cls
          currentText = line[i]
        }
      }

      if (currentText) {
        spans.push(
          <span key={spans.length} className={currentClass}>
            {currentText}
          </span>
        )
      }

      return (
        <div key={lineIdx}>
          {spans.length > 0 ? spans : <span>&nbsp;</span>}
        </div>
      )
    })
  }, [canHighlight, deferredLines, lineOffsets, tokens, isDark])

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
          className="overflow-hidden bg-muted/20 select-none z-10"
          style={{ fontSize: `${fontSize}px` }}
        >
          {lineNumbers}
        </div>

        {/* Textarea + Highlight wrapper — keeps highlight layer scoped to textarea only */}
        <div className="flex-1 relative flex flex-col">
          {/* Highlight Layer — positioned within textarea bounds only */}
          {canHighlight && (
            <div
              ref={highlightRef}
              className="absolute inset-0 pointer-events-none overflow-hidden font-mono text-sm p-4 z-0"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: "1.5em",
                whiteSpace: wordWrap ? "pre-wrap" : "pre",
                wordBreak: wordWrap ? "break-word" : "normal",
                tabSize: tabSize,
              }}
            >
              {highlightedContent}
            </div>
          )}

          {/* Textarea — sits above highlight layer with z-10 */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            className={cn(
              "flex-1 bg-transparent text-editor-cursor font-mono p-4 resize-none outline-none z-10",
              "scrollbar-thin placeholder-muted-foreground/50",
              canHighlight ? "bg-transparent/50 text-transparent caret-editor-cursor" : "",
              wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-auto"
            )}
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: "1.5em",
              tabSize: tabSize,
              caretColor: canHighlight ? "var(--editor-cursor)" : "auto",
            }}
            spellCheck="false"
            autoCapitalize="off"
            autoCorrect="off"
            wrap={wordWrap ? "soft" : "off"}
          />

          {/* Error line indicators — thin red bars on the left of each error line */}
          {errorLines.length > 0 && (
            <div className="absolute left-0 top-0 bottom-0 w-full pointer-events-none z-20 overflow-hidden">
              {errorLines.map((err) => {
                const top = (err.line - 1) * fontSize * 1.5 + 16 // 16px = p-4 top padding
                return (
                  <div
                    key={err.line}
                    className="absolute left-0 right-0 bg-destructive/15 border-l-[3px] border-destructive"
                    style={{
                      top: `${top}px`,
                      height: `${fontSize * 1.5}px`,
                    }}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-7 border-t border-border bg-muted/20 px-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{lines.length} lines</span>
        <div className="flex items-center gap-3">
          <span>{content.length} chars</span>
          {onAISpotlight && (
            <button
              onClick={onAISpotlight}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              title="Open AI Spotlight (Cmd+K)"
            >
              <Sparkles className="h-3 w-3" />
              AI
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
