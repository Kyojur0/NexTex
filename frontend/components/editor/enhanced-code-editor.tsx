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
  const errorBgRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [lineHeights, setLineHeights] = useState<number[]>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Listen for jump-to-line events from the terminal
  useEffect(() => {
    const handler = (e: CustomEvent<{ line: number }>) => {
      if (textareaRef.current) {
        const linesArr = content.split("\n")
        const targetLine = Math.max(0, e.detail.line - 1)
        const charOffset = linesArr.slice(0, targetLine).join("\n").length
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(charOffset, charOffset + (linesArr[targetLine]?.length || 0))
        // Sum wrapped heights of lines before target
        const scrollOffset = lineHeights.slice(0, targetLine).reduce((a, b) => a + b, 0) - 80
        textareaRef.current.scrollTop = Math.max(0, scrollOffset)
      }
    }
    window.addEventListener("editor:jump-to-line", handler as EventListener)
    return () => window.removeEventListener("editor:jump-to-line", handler as EventListener)
  }, [content, lineHeights])

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

  // Sync scroll between textarea and highlights / error backgrounds
  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const textarea = e.target as HTMLTextAreaElement
    if (highlightRef.current) {
      highlightRef.current.scrollTop = textarea.scrollTop
      highlightRef.current.scrollLeft = textarea.scrollLeft
    }
    if (errorBgRef.current) {
      errorBgRef.current.scrollTop = textarea.scrollTop
      errorBgRef.current.scrollLeft = textarea.scrollLeft
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

  // Measure wrapped line heights so line numbers / overlays stay aligned
  const runMeasurement = useCallback(() => {
    const textarea = textareaRef.current
    const measure = measureRef.current
    if (!textarea || !measure) return

    if (!wordWrap) {
      const h = fontSize * 1.5
      setLineHeights(lines.map(() => h))
      return
    }

    const computed = window.getComputedStyle(textarea)
    measure.style.width = `${textarea.clientWidth}px`
    measure.style.paddingLeft = computed.paddingLeft
    measure.style.paddingRight = computed.paddingRight
    measure.style.boxSizing = "border-box"
    measure.style.fontFamily = computed.fontFamily
    measure.style.fontSize = computed.fontSize
    measure.style.fontWeight = computed.fontWeight
    measure.style.fontStyle = computed.fontStyle
    measure.style.lineHeight = computed.lineHeight
    measure.style.letterSpacing = computed.letterSpacing
    measure.style.tabSize = computed.tabSize

    const children = measure.children
    const heights: number[] = []
    for (let i = 0; i < children.length; i++) {
      heights.push((children[i] as HTMLElement).offsetHeight)
    }
    setLineHeights(heights)
  }, [lines, fontSize, wordWrap])

  const measureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced measurement on content / font / wrap changes
  useEffect(() => {
    if (measureTimeoutRef.current) clearTimeout(measureTimeoutRef.current)
    measureTimeoutRef.current = setTimeout(() => runMeasurement(), 50)
    return () => {
      if (measureTimeoutRef.current) clearTimeout(measureTimeoutRef.current)
    }
  }, [runMeasurement])

  // Immediate measurement on textarea resize
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || !wordWrap) return
    const observer = new ResizeObserver(() => runMeasurement())
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [runMeasurement, wordWrap])

  // Memoize line numbers — subtle red indicator for error lines
  const lineNumbers = useMemo(() => {
    const errorLineSet = new Set(errorLines.map((e) => e.line))
    const fallbackHeight = fontSize * 1.5
    return lines.map((_, i) => {
      const hasError = errorLineSet.has(i + 1)
      const h = lineHeights[i] ?? fallbackHeight
      return (
        <div
          key={i}
          style={{ height: `${h}px` }}
          className={cn(
            "flex items-center justify-end pr-3 text-xs border-r border-border/30 transition-colors",
            hasError ? "text-destructive font-semibold" : "text-muted-foreground"
          )}
          title={hasError ? errorLines.find((e) => e.line === i + 1)?.message : undefined}
        >
          {hasError && <span className="mr-1.5 w-1 h-1 rounded-full bg-destructive inline-block" />}
          {i + 1}
        </div>
      )
    })
  }, [lines.length, errorLines, lineHeights, fontSize])

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

      const h = lineHeights[lineIdx] ?? fontSize * 1.5
      return (
        <div key={lineIdx} style={{ height: `${h}px` }}>
          {spans.length > 0 ? spans : <span>&nbsp;</span>}
        </div>
      )
    })
  }, [canHighlight, deferredLines, lineOffsets, tokens, isDark, lineHeights, fontSize])

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-editor-bg border border-border/60 rounded-xl overflow-hidden shadow-elevated"
    >
      {/* Header */}
      <div className="h-10 border-b border-border/40 bg-muted/40 px-4 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          {fileName}
        </span>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Line Numbers */}
        <div
          data-line-numbers
          className="overflow-hidden bg-muted/20 select-none z-10 pt-4 pb-4"
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

          {/* Error background layer — subtle light red for entire line width */}
          {errorLines.length > 0 && (
            <div
              ref={errorBgRef}
              className="absolute inset-0 pointer-events-none overflow-hidden font-mono text-sm p-4 z-[1]"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: "1.5em",
                whiteSpace: wordWrap ? "pre-wrap" : "pre",
                wordBreak: wordWrap ? "break-word" : "normal",
                tabSize: tabSize,
                color: "transparent",
              }}
            >
              {lines.map((_, i) => {
                const hasError = errorLines.some((e) => e.line === i + 1)
                const h = lineHeights[i] ?? fontSize * 1.5
                return (
                  <div
                    key={i}
                    style={{ height: `${h}px` }}
                    className={cn(
                      hasError
                        ? "bg-destructive/15 border-l-2 border-destructive/40"
                        : ""
                    )}
                  />
                )
              })}
            </div>
          )}

          {/* Textarea — sits above all layers with z-10 */}
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
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-8 border-t border-border/40 bg-muted/40 px-4 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="tabular-nums">{lines.length} lines</span>
        <div className="flex items-center gap-4">
          <span className="tabular-nums">{content.length.toLocaleString()} chars</span>
          {onAISpotlight && (
            <button
              onClick={onAISpotlight}
              className="flex items-center gap-1.5 hover:text-foreground transition-colors px-2 py-0.5 rounded-md hover:bg-muted"
              title="Open AI Spotlight (Cmd+K)"
            >
              <Sparkles className="h-3 w-3" />
              AI
            </button>
          )}
        </div>
      </div>

      {/* Hidden measurement div for wrapped line heights */}
      <div
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          left: -9999,
          top: -9999,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              whiteSpace: wordWrap ? "pre-wrap" : "pre",
              wordBreak: wordWrap ? "break-word" : "normal",
              minHeight: `${fontSize * 1.5}px`,
            }}
          >
            {line || "\u00A0"}
          </div>
        ))}
      </div>
    </div>
  )
})
