"use client"

import { memo, useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, X, Check, RotateCcw, ChevronDown, Loader } from "lucide-react"
import { cn } from "@/lib/utils"

interface AISpotlightProps {
  selectedCode: string
  currentContent: string
  onAccept: (newContent: string) => void
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
  onAccept,
  onClose,
  aiModel,
}: AISpotlightProps) {
  const [stage, setStage] = useState<Stage>("input")
  const [prompt, setPrompt] = useState("")
  const [suggestion, setSuggestion] = useState("")
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const handleSubmit = useCallback(async (promptText: string) => {
    if (!promptText.trim()) return
    setPrompt(promptText)
    setStage("loading")
    setError(null)

    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          code: selectedCode || currentContent,
          model: aiModel,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || "Request failed")
      setSuggestion(data.suggestion)
      setStage("diff")
    } catch (err: any) {
      setError(err.message || "Something went wrong")
      setStage("input")
    }
  }, [selectedCode, currentContent, aiModel])

  const handleAccept = useCallback(() => {
    if (!suggestion) return
    // Replace selected code (or full content if nothing selected) with suggestion
    const base = selectedCode || currentContent
    const newContent = selectedCode
      ? currentContent.replace(selectedCode, suggestion)
      : suggestion
    onAccept(newContent)
  }, [suggestion, selectedCode, currentContent, onAccept])

  const handleReject = useCallback(() => {
    setStage("input")
    setSuggestion("")
    setPrompt("")
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const diff = stage === "diff" ? computeLineDiff(selectedCode || currentContent, suggestion) : []
  const changedCount = diff.filter(d => d.changed).length

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Modal */}
      <div
        className={cn(
          "w-full max-w-2xl rounded-2xl border border-border/60 shadow-2xl overflow-hidden",
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
            <span className="text-sm font-semibold">AI Assistant</span>
            {aiModel && (
              <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted font-mono">
                {aiModel.split("/").pop() || "Model"}
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Input stage */}
        {(stage === "input" || stage === "loading") && (
          <div className="flex flex-col p-4 gap-3">
            {/* Quick actions */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => handleSubmit(action)}
                  disabled={stage === "loading"}
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
                disabled={stage === "loading"}
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
                disabled={!prompt.trim() || stage === "loading"}
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

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
            )}

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
                <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400">{changedCount} removed</span>
                <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">{changedCount} added</span>
              </div>
              <button
                onClick={handleReject}
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
                className="h-8 px-4 text-xs"
              >
                Reject
              </Button>
              <Button
                size="sm"
                onClick={handleAccept}
                className="h-8 px-4 text-xs gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                Accept changes
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
