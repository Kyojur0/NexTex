"use client"

import { useEffect, useRef } from "react"
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
  defaultData: { latex: "E = mc^2" },
  renderConfig: ({ block, onChange }) => (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">LaTeX</label>
      <textarea
        value={block.data.latex}
        onChange={(e) => onChange({ ...block.data, latex: e.target.value })}
        rows={4}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="e.g. E = mc^2"
      />
    </div>
  ),
  renderPreview: ({ block }) => {
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => {
      if (!ref.current) return
      try {
        katex.render(block.data.latex, ref.current, {
          displayMode: true,
          throwOnError: false,
        })
      } catch {
        if (ref.current) ref.current.textContent = block.data.latex
      }
    }, [block.data.latex])
    return (
      <div className="flex justify-center py-2 overflow-x-auto">
        <div ref={ref} className="text-foreground" />
      </div>
    )
  },
  toLaTeX: (data) =>
    `\\begin{equation}\n${data.latex.trim()}\n\\end{equation}`,
}
