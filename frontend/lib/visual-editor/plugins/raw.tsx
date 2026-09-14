"use client"

import { FileCode } from "lucide-react"
import type { BlockPlugin } from "../types"

export interface RawData { latex: string }

export const rawPlugin: BlockPlugin<RawData> = {
  type: "raw", label: "LaTeX source", icon: FileCode, color: "#64748b",
  defaultData: { latex: "" }, isText: false,
  renderEditor: ({ block, onChange, onFocus, onBlur }) => (
    <div className="py-2">
      <label className="block text-xs text-[var(--visual-editor-text-dim)] mb-2">
        {block.boundary === "start" ? "Document preamble" : block.boundary === "end" ? "Document ending" : "LaTeX source"}
        <textarea
          aria-label={block.boundary ? "Document source" : "LaTeX source"}
          value={block.data.latex}
          onChange={e => onChange({ latex: e.target.value })}
          onFocus={onFocus} onBlur={onBlur}
          rows={Math.min(14, Math.max(2, block.data.latex.split("\n").length))}
          spellCheck={false}
          className="block mt-2 w-full resize-y rounded-md border border-[var(--visual-editor-toolbar-border)] bg-[var(--visual-editor-bg)] p-3 font-mono text-xs text-[var(--visual-editor-text)]"
        />
      </label>
    </div>
  ),
  toLaTeX: data => data.latex,
}
