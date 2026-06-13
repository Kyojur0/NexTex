"use client"

import { useEffect, useRef } from "react"
import { Sigma } from "lucide-react"
import katex from "katex"
import "katex/dist/katex.min.css"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
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
  renderConfig: ({ block, onChange }) => (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">LaTeX</Label>
      <Textarea
        value={block.data.latex}
        onChange={(e) => onChange({ ...block.data, latex: e.target.value })}
        rows={4}
        className="font-mono text-sm resize-y"
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
