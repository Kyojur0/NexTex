"use client"

import { memo, useRef } from "react"
import { cn } from "@/lib/utils"

interface LatexOutputPanelProps {
  latex: string
}

// Very small LaTeX syntax highlighter matching Fable5 token colors
function highlight(line: string): React.ReactNode {
  if (/^\s*%/.test(line)) {
    return <span style={{ color: "var(--tok-com)" }}>{line}</span>
  }

  const nodes: React.ReactNode[] = []
  const token = /\\(?:begin|end)\{[a-zA-Z*]+\}|\$[^$]*\$|\\[a-zA-Z@]+/g
  let last = 0
  for (const match of line.matchAll(token)) {
    if (match.index > last) nodes.push(<span key={nodes.length}>{line.slice(last,match.index)}</span>)
    const environment = match[0].match(/^(\\(?:begin|end))\{([^}]+)\}$/)
    nodes.push(environment
      ? <span key={nodes.length}><span style={{color:"var(--tok-cmd)"}}>{environment[1]}</span>{'{'}<span style={{color:"var(--tok-env)"}}>{environment[2]}</span>{'}'}</span>
      : <span key={nodes.length} style={{color:match[0].startsWith('$') ? "var(--tok-math)" : "var(--tok-cmd)"}}>{match[0]}</span>)
    last = match.index + match[0].length
  }
  if (last < line.length) nodes.push(<span key={nodes.length}>{line.slice(last)}</span>)
  return <>{nodes}</>
}

export const LatexOutputPanel = memo(function LatexOutputPanel({
  latex,
}: LatexOutputPanelProps) {
  const codeRef = useRef<HTMLDivElement>(null)
  const lines = latex.split("\n")

  return (
    <div
      data-testid="latex-output-panel"
      className="h-full flex flex-col"
      style={{ background: "var(--code-bg)" }}
    >
      {/* Header */}
      <div
        className="h-[38px] flex items-center gap-2 px-3 shrink-0"
        style={{
          borderBottom: "1px solid var(--code-border)",
          background: "var(--code-bg)",
        }}
      >
        <span className="font-mono text-[11px]" style={{ color: "var(--visual-editor-text-dim)" }}>{"{ }"}</span>
        <span className="text-[12px] font-semibold" style={{ color: "var(--visual-editor-text)" }}>
          document.tex
        </span>

        {/* LIVE badge */}
        <span
          className="flex items-center gap-1 h-[17px] px-1.5 rounded-full text-[10px] font-semibold tracking-wide"
          style={{
            background: "var(--visual-editor-tool-active)",
            color: "var(--visual-editor-tool-active-text)",
          }}
        >
          <span
            className="w-[5px] h-[5px] rounded-full animate-pulse"
            style={{ background: "var(--visual-editor-tool-active-text)" }}
          />
          LIVE
        </span>

        {/* Copy icon */}
        <button
          type="button"
          className="ml-auto opacity-50 hover:opacity-90 transition-opacity"
          title="Copy LaTeX"
          onClick={() => navigator.clipboard?.writeText(latex)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect x="4" y="4" width="6.5" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M2.5 8H2C1.4 8 1 7.6 1 7V2C1 1.4 1.4 1 2 1H7C7.6 1 8 1.4 8 2V2.5" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </button>
      </div>

      {/* Code area */}
      <div
        ref={codeRef}
        className="flex-1 overflow-y-auto scrollbar-thin py-3 font-mono"
        style={{
          fontSize: "11px",
          lineHeight: "1.8",
          color: "var(--code-text)",
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn("flex", "px-0")}
          >
            {/* Line number */}
            <span
              className="shrink-0 select-none text-right pr-2.5"
              style={{
                width: "34px",
                color: "var(--code-ln)",
                fontSize: "10px",
                paddingTop: "1px",
                userSelect: "none",
              }}
            >
              {i + 1}
            </span>
            {/* Content */}
            <span
              data-testid="latex-output-line"
              className="flex-1 pr-3 whitespace-pre-wrap break-all"
              style={{ color: "var(--code-text)" }}
            >
              {line ? highlight(line) : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})
