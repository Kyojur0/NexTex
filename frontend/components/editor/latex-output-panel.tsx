"use client"

import { memo } from "react"
import { FileCode2 } from "lucide-react"

interface LatexOutputPanelProps {
  latex: string
}

export const LatexOutputPanel = memo(function LatexOutputPanel({
  latex,
}: LatexOutputPanelProps) {
  return (
    <div data-testid="latex-output-panel" className="h-full flex flex-col bg-card/30 border-l border-border/40 backdrop-blur-sm">
      <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2">
        <FileCode2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Live LaTeX
        </span>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="font-mono text-[11px] text-foreground/75 whitespace-pre-wrap break-all leading-relaxed">
          <code>{latex}</code>
        </pre>
      </div>
    </div>
  )
})
