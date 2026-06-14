"use client"

import { useEffect, useRef, useCallback } from "react"
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
      <div className="space-y-3">
        <div className="flex justify-center py-2 overflow-x-auto bg-muted/20 rounded-xl">
          <div ref={previewRef} className="text-foreground" />
        </div>
        {isActive && (
          <div className="space-y-1.5" onFocus={onFocus} onBlur={onBlur}>
            <Label className="text-xs text-muted-foreground">LaTeX</Label>
            <Textarea
              value={block.data.latex}
              onChange={(e) => handleChange(e.target.value)}
              rows={3}
              className="font-mono text-sm resize-y"
              placeholder="e.g. E = mc^2"
            />
          </div>
        )}
      </div>
    )
  },
  toLaTeX: (data) => `\\begin{equation}\n${data.latex.trim()}\n\\end{equation}`,
}
