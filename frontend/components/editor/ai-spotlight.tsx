"use client"

import { memo, useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, X, Check, RotateCcw, ChevronDown, Loader } from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface AISpotlightProps {
  selectedCode: string
  currentContent: string
  documentId: string
  selectedRange?: { start: number; end: number }
  onAccept: (newContent: string) => void | Promise<void>
  onClose: () => void
  aiModel: string
}

type Stage = "input" | "loading" | "diff"

const QUICK_ACTIONS = [
  "Fix grammar and improve clarity",
  "Make this more professional",
  "Shorten to key points",
  "Debug LaTeX errors",
  "Add bullet points",
  "Improve formatting",
]

function computeLineDiff(original: string, suggested: string) {
  const origLines = original.split("\n")
  const suggLines = suggested.split("\n")
  const maxLen = Math.max(origLines.length, suggLines.length)
  const result: Array<{ orig: string | null; sugg: string | null; changed: boolean }> = []

  for (let i = 0; i < maxLen; i++) {
    const o = origLines[i] ?? null
    const s = suggLines[i] ?? null
    result.push({ orig: o, sugg: s, changed: o !== s })
  }
  return result
}

export const AISpotlight = memo(function AISpotlight({
  selectedCode,
  currentContent,
  documentId,
  selectedRange,
  onAccept,
  onClose,
  aiModel,
}: AISpotlightProps) {
  const [stage, setStage] = useState<Stage>("input")
  const [prompt, setPrompt] = useState("")
  const [suggestion, setSuggestion] = useState("")
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [configuration, setConfiguration] = useState<{ configured: boolean; provider: string | null; local?: boolean; message: string } | null>(null)
  const [original, setOriginal] = useState<{ documentId: string; content: string; code: string; start: number; end: number } | null>(null)
  const currentRef = useRef({ documentId, currentContent })
  currentRef.current = { documentId, currentContent }
  const stale = !!original && (original.documentId !== documentId || original.content !== currentContent)

  // Focus input on mount
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/ai/suggest', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Configuration unavailable')
        const data = await response.json()
        if (typeof data.configured !== 'boolean' || typeof data.message !== 'string') throw new Error('Invalid configuration')
        setConfiguration(data)
      })
      .catch(() => {
        if (!controller.signal.aborted) setConfiguration({ configured: false, provider: null, message: 'Could not check AI configuration. Restart the frontend and reopen this dialog.' })
      })
    return () => { controller.abort(); requestRef.current?.abort() }
  }, [])

  const handleSubmit = useCallback(async (promptText: string) => {
    if (!promptText.trim() || !configuration?.configured || requestRef.current) return
    if (!currentContent.trim()) { setError('Open a document with some text first.'); return }
    let start = 0
    let end = currentContent.length
    if (selectedCode && selectedCode !== currentContent) {
      if (selectedRange && currentContent.slice(selectedRange.start, selectedRange.end) === selectedCode) {
        start = selectedRange.start
        end = selectedRange.end
      } else {
        start = currentContent.indexOf(selectedCode)
        if (start < 0 || currentContent.indexOf(selectedCode, start + 1) !== -1) {
          setError('The selected text is missing or appears more than once. Reselect the passage or work with the full document.')
          return
        }
        end = start + selectedCode.length
      }
    }
    const source = { documentId, content: currentContent, code: currentContent.slice(start, end), start, end }
    setOriginal(source)
    setPrompt(promptText)
    setStage("loading")
    setError(null)

    const controller = new AbortController()
    requestRef.current = controller
    const timeout = setTimeout(() => controller.abort(), 50_000)
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          code: source.code,
          model: aiModel,
        }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || "Request failed")
      if (typeof data.suggestion !== 'string' || !data.suggestion.trim()) throw new Error('The AI response was empty. Please try again.')
      setSuggestion(data.suggestion)
      setStage("diff")
    } catch (err) {
      setError(controller.signal.aborted ? 'The request was cancelled or timed out. Please try again.' : err instanceof Error ? err.message : 'Something went wrong')
      setStage("input")
    } finally {
      clearTimeout(timeout)
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [selectedCode, selectedRange, currentContent, documentId, aiModel, configuration])

  const handleAccept = useCallback(async () => {
    if (!suggestion || !original || accepting) return
    if (currentRef.current.documentId !== original.documentId || currentRef.current.currentContent !== original.content) {
      setError('The document changed after this request. Generate a new suggestion before accepting.')
      return
    }
    setAccepting(true)
    setError(null)
    try {
      await onAccept(original.content.slice(0, original.start) + suggestion + original.content.slice(original.end))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply the suggestion.')
    } finally {
      setAccepting(false)
    }
  }, [suggestion, original, accepting, onAccept])

  const handleReject = useCallback(() => {
    setStage("input")
    setSuggestion("")
    setPrompt("")
    setOriginal(null)
    setError(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const diff = stage === "diff" ? computeLineDiff(original?.code ?? '', suggestion) : []
  const changedCount = diff.filter(d => d.changed).length
  const unavailable = !configuration?.configured

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !accepting) onClose() }}>
      <DialogContent showCloseButton={false}
        className={cn(
          "w-full sm:max-w-2xl rounded-2xl border border-border/60 shadow-2xl overflow-hidden p-0 gap-0",
          "flex flex-col",
          // Glassmorphism
          "bg-background/80 backdrop-blur-xl",
        )}
        style={{ maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <DialogTitle className="text-sm font-semibold">AI Assistant</DialogTitle>
            {aiModel && (
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted font-mono truncate max-w-40" title={aiModel}>
                {aiModel.split("/").pop() || "Model"}
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose} aria-label="Close AI assistant" disabled={accepting}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <DialogDescription className="px-5 py-2 text-xs border-b border-border/40">
          {configuration?.configured
            ? `${selectedCode && selectedCode !== currentContent ? 'Your selection' : 'Your document'} will be sent to ${configuration.local ? 'your local AI server' : 'your configured AI provider'}. Review the suggestion before applying it.`
            : configuration?.message ?? 'Checking AI configuration…'}
        </DialogDescription>
        {(error || stale) && <p role="alert" className="text-xs text-destructive bg-destructive/10 px-5 py-2">
          {stale ? 'The document changed after this request. Generate a new suggestion before accepting.' : error}
        </p>}

        {/* Input stage */}
        {(stage === "input" || stage === "loading") && (
          <div className="flex flex-col p-4 gap-3 overflow-y-auto">
            {/* Quick actions */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => handleSubmit(action)}
                  disabled={stage === "loading" || unavailable}
                  className="text-xs px-2.5 py-1 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/40 hover:bg-muted transition-all disabled:opacity-40"
                >
                  {action}
                </button>
              ))}
            </div>

            {/* Prompt input */}
            <div className="relative">
              <textarea
                ref={inputRef}
                aria-label="AI instruction"
                maxLength={8000}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(prompt)
                  }
                  if (e.key === "Escape") onClose()
                }}
                placeholder="Describe what you want to change... (Enter to send, Shift+Enter for newline)"
                disabled={stage === "loading" || unavailable}
                rows={2}
                className={cn(
                  "w-full resize-none rounded-xl border border-border/60 bg-muted/30 px-4 py-3 pr-12",
                  "text-sm placeholder:text-muted-foreground/60 outline-none",
                  "focus:border-primary/40 focus:ring-0 transition-colors",
                  "font-sans leading-relaxed",
                  "disabled:opacity-50"
                )}
              />
              <button
                onClick={() => handleSubmit(prompt)}
                aria-label="Generate suggestion"
                disabled={!prompt.trim() || stage === "loading" || unavailable}
                className={cn(
                  "absolute right-3 bottom-3 w-7 h-7 rounded-lg flex items-center justify-center transition-all",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                {stage === "loading" ? (
                  <Loader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
                )}
              </button>
            </div>

            {stage === "loading" && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader className="h-3.5 w-3.5 animate-spin" />
                Generating suggestion...
              </div>
            )}
          </div>
        )}

        {/* Diff stage */}
        {stage === "diff" && (
          <div className="flex flex-col overflow-hidden flex-1 min-h-0">
            {/* Diff header bar */}
            <div className="flex items-center justify-between px-5 py-2.5 bg-muted/30 border-b border-border/40 shrink-0">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Suggested changes</span>
                <span>{changedCount} changed line positions</span>
              </div>
              <button
                onClick={handleReject}
                disabled={accepting}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="h-3 w-3" /> Try again
              </button>
            </div>

            {/* Diff columns */}
            <div className="flex-1 overflow-y-auto scrollbar-thin font-mono text-xs">
              <div className="grid grid-cols-2 divide-x divide-border/40 min-h-full">
                {/* Original */}
                <div className="overflow-x-auto">
                  <div className="px-2 py-1 bg-red-500/5 border-b border-border/30 text-xs text-muted-foreground font-sans sticky top-0">
                    Before
                  </div>
                  {diff.map((row, i) => (
                    <div
                      key={i}
                      className={cn(
                        "px-3 py-0.5 leading-5 whitespace-pre-wrap break-all",
                        row.changed && row.orig !== null && "bg-red-500/10 text-red-700 dark:text-red-300"
                      )}
                    >
                      {row.orig ?? <span className="opacity-0">.</span>}
                    </div>
                  ))}
                </div>

                {/* Suggested */}
                <div className="overflow-x-auto">
                  <div className="px-2 py-1 bg-green-500/5 border-b border-border/30 text-xs text-muted-foreground font-sans sticky top-0">
                    After
                  </div>
                  {diff.map((row, i) => (
                    <div
                      key={i}
                      className={cn(
                        "px-3 py-0.5 leading-5 whitespace-pre-wrap break-all",
                        row.changed && row.sugg !== null && "bg-green-500/10 text-green-700 dark:text-green-300"
                      )}
                    >
                      {row.sugg ?? <span className="opacity-0">.</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Accept / Reject buttons */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border/40 shrink-0 bg-background/60">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReject}
                disabled={accepting}
                className="h-8 px-4 text-xs"
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={handleAccept}
                disabled={stale || accepting}
                className="h-8 px-4 text-xs gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                {accepting ? 'Applying…' : 'Accept changes'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
})
