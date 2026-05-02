"use client"

import { memo, useRef, useEffect, useCallback, useState, useMemo } from "react"
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
}: EnhancedCodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [jumpLine, setJumpLine] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Listen for jump-to-line events from the terminal
  useEffect(() => {
    const handler = (e: CustomEvent<{ line: number }>) => {
      setJumpLine(e.detail.line)
      if (textareaRef.current) {
        const lines = content.split("\n")
        const targetLine = Math.max(0, e.detail.line - 1)
        const charOffset = lines.slice(0, targetLine).join("\n").length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(charOffset, charOffset + (lines[targetLine]?.length || 0))
        const lineHeight = fontSize * 1.5
        textareaRef.current.scrollTop = targetLine * lineHeight - 80
      }
      setTimeout(() => setJumpLine(null), 2000)
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

  const lineOffsets = useMemo(() => {
    const offsets: number[] = []
    let offset = 0
    for (const line of lines) {
      offsets.push(offset)
      offset += line.length + 1 // +1 for newline char
    }
    return offsets
  }, [lines])

  const tokens = useMemo(() => {
    if (!enableSyntaxHighlight || !mounted) return []
    return tokenizeLaTeX(content)
  }, [content, enableSyntaxHighlight, mounted])

  // Build a Map for O(1) token lookup by absolute character position
  const tokenMap = useMemo(() => {
    const map = new Map<number, Token>()
    for (const token of tokens) {
      for (let i = token.start; i < token.end; i++) {
        map.set(i, token)
      }
    }
    return map
  }, [tokens])

  const isDark = mounted && theme === "dark"

  // Memoize line numbers so they only re-render when line count changes
  const lineNumbers = useMemo(() => {
    return lines.map((_, i) => (
      <div
        key={i}
        className="h-[1.5em] flex items-center justify-end pr-4 text-xs text-muted-foreground border-r border-border/30"
      >
        {i + 1}
      </div>
    ))
  }, [lines.length])

  // Memoize highlighted content — groups consecutive same-token chars into single spans
  const highlightedContent = useMemo(() => {
    if (!enableSyntaxHighlight || !mounted) return null

    return lines.map((line, lineIdx) => {
      const lineStart = lineOffsets[lineIdx]
      const spans: React.ReactElement[] = []
      let currentClass = ""
      let currentText = ""

      for (let i = 0; i < line.length; i++) {
        const absPos = lineStart + i
        const token = tokenMap.get(absPos)
        const cls = token ? getTokenColor(token.type, isDark) : "text-foreground"

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
        <div key={lineIdx} style={{ height: "1.5em" }}>
          {spans.length > 0 ? spans : <span>&nbsp;</span>}
        </div>
      )
    })
  }, [lines, lineOffsets, tokenMap, enableSyntaxHighlight, mounted, isDark])

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
          {lineNumbers}
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
              wordBreak: "break-word",
              color: "transparent",
            }}
          >
            {highlightedContent}
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
            wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-auto"
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
          wrap={wordWrap ? "soft" : "off"}
        />
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
