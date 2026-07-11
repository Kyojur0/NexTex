"use client"

import { useEffect, useRef, useCallback } from "react"
import { Sigma } from "lucide-react"
import katex from "katex"
import "katex/dist/katex.min.css"
import type { BlockPlugin } from "../types"

export interface MathData {
  latex: string
}

export const mathPlugin: BlockPlugin<MathData> = {
  type: "math",
  label: "Equation",
  icon: Sigma,
  color: "#8b5cf6",
  defaultData: { latex: "E = mc^2" },
  isText: false,
  renderEditor: ({ block, isActive, onChange, onFocus, onBlur }) => {
    const previewRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      if (!previewRef.current) return
      try {
        katex.render(block.data.latex, previewRef.current, {
          displayMode: true,
          throwOnError: false,
        })
      } catch {
        if (previewRef.current) previewRef.current.textContent = block.data.latex
      }
    }, [block.data.latex])

    const handleChange = useCallback(
      (latex: string) => onChange({ ...block.data, latex }),
      [block.data, onChange],
    )

    return (
      <div onFocus={onFocus} onBlur={onBlur} style={{ padding: "6px 0" }}>
        {/* Fable5 equation layout: spacer | equation centered | number right */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: "44px", flexShrink: 0 }} />
          <div
            ref={previewRef}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: "19px",
              fontStyle: "italic",
              color: "var(--visual-editor-text)",
              letterSpacing: "0.01em",
              overflowX: "auto",
            }}
          />
          <div
            style={{
              width: "44px",
              flexShrink: 0,
              textAlign: "right",
              fontSize: "14px",
              color: "var(--visual-editor-text-dim)",
              fontFamily: "Georgia, serif",
            }}
          >
            {/* equation number — placeholder */}
          </div>
        </div>

        {/* LaTeX input — shown only when active */}
        {isActive && (
          <div style={{ marginTop: "10px" }}>
            <input
              type="text"
              value={block.data.latex}
              onChange={(e) => handleChange(e.target.value)}
              autoFocus
              style={{
                width: "100%",
                background: "var(--visual-editor-bg)",
                border: "1px solid var(--visual-editor-toolbar-border)",
                borderRadius: "5px",
                padding: "6px 12px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "12px",
                color: "var(--visual-editor-text)",
                outline: "none",
                caretColor: "var(--primary)",
              }}
              placeholder="LaTeX expression, e.g. E = mc^2"
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        )}
      </div>
    )
  },
  toLaTeX: (data) => `\\begin{equation}\n${data.latex.trim()}\n\\end{equation}`,
}
