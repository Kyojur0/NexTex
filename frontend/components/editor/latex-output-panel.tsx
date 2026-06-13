"use client"

import { memo } from "react"

interface LatexOutputPanelProps {
  latex: string
}

export const LatexOutputPanel = memo(function LatexOutputPanel({
  latex,
}: LatexOutputPanelProps) {
  return (
    <div data-testid="latex-output-panel" className="h-full flex flex-col bg-muted/20 border-l border-border/60">
      <div className="px-3 py-2 border-b border-border/40">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Live LaTeX Output
        </span>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <pre className="font-mono text-xs text-foreground/80 whitespace-pre-wrap break-all">
          <code>{latex}</code>
        </pre>
      </div>
    </div>
  )
})
