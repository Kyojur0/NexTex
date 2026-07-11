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

  // Split on math spans ($...$) first, mark them
  const parts: React.ReactNode[] = []
  const mathSplit = line.split(/(\$[^$]*\$)/g)
  mathSplit.forEach((part, i) => {
    if (part.startsWith("$") && part.endsWith("$") && part.length > 1) {
      parts.push(
        <span key={i} style={{ color: "var(--tok-math)" }}>{part}</span>
      )
      return
    }
    // Highlight \begin{env} / \end{env}
    const envReplaced = part.replace(
      /(\\begin|\\end)\{([a-zA-Z*]+)\}/g,
      (_, cmd, env) => `\x00cmd\x00${cmd}\x00/cmd\x00{\x00env\x00${env}\x00/env\x00}`,
    )
    if (envReplaced !== part) {
      // Re-parse after env substitution — simpler: just render as-is with coloring
      const nodes: React.ReactNode[] = []
      let remaining = part
      let k = 0
      const envRegex = /(\\begin|\\end)\{([a-zA-Z*]+)\}/g
      let last = 0
      let m: RegExpExecArray | null
      while ((m = envRegex.exec(remaining)) !== null) {
        if (m.index > last) {
          const seg = remaining.slice(last, m.index)
          nodes.push(...highlightCommands(seg, k++))
        }
        nodes.push(
          <span key={k++} style={{ color: "var(--tok-cmd)" }}>{m[1]}</span>,
          <span key={k++}>{`{`}</span>,
          <span key={k++} style={{ color: "var(--tok-env)" }}>{m[2]}</span>,
          <span key={k++}>{`}`}</span>,
        )
        last = m.index + m[0].length
      }
      if (last < remaining.length) {
        nodes.push(...highlightCommands(remaining.slice(last), k++))
      }
      parts.push(...nodes)
    } else {
      parts.push(...highlightCommands(part, i * 100))
    }
  })
  return <>{parts}</>
}

function highlightCommands(text: string, baseKey: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const cmdRegex = /\\[a-zA-Z@]+/g
  let last = 0
  let k = baseKey
  let m: RegExpExecArray | null
  while ((m = cmdRegex.exec(text)) !== null) {
    if (m.index > last) nodes.push(<span key={k++}>{text.slice(last, m.index)}</span>)
    nodes.push(<span key={k++} style={{ color: "var(--tok-cmd)" }}>{m[0]}</span>)
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(<span key={k++}>{text.slice(last)}</span>)
  return nodes
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
              className="flex-1 pr-3 whitespace-pre-wrap break-all"
              style={{ color: "var(--code-text)" }}
            >
              {line ? highlight(line) : " "}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})
