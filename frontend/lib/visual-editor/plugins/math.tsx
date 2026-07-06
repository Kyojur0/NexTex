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
  label: "Math",
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
      [block.data, onChange]
    )

    return (
      <div className="py-2" onFocus={onFocus} onBlur={onBlur}>
        <div className="flex justify-center overflow-x-auto">
          <div ref={previewRef} className="text-[var(--visual-editor-text)]" />
        </div>
        {isActive && (
          <div className="mt-2">
            <input
              type="text"
              value={block.data.latex}
              onChange={(e) => handleChange(e.target.value)}
              className="w-full bg-[var(--visual-editor-bg)] border border-[var(--visual-editor-toolbar-border)] rounded-md px-3 py-1.5 font-mono text-sm text-[var(--visual-editor-text)] placeholder:text-[var(--visual-editor-text-dim)] focus:outline-none focus:border-[var(--primary)]"
              placeholder="e.g. E = mc^2"
            />
          </div>
        )}
      </div>
    )
  },
  toLaTeX: (data) => `\\begin{equation}\n${data.latex.trim()}\n\\end{equation}`,
}
