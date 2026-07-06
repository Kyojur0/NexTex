"use client"

import { useCallback } from "react"
import { Code as CodeIcon } from "lucide-react"
import type { BlockPlugin } from "../types"

export interface CodeData {
  language: string
  code: string
}

export const codePlugin: BlockPlugin<CodeData> = {
  type: "code",
  label: "Code",
  icon: CodeIcon,
  color: "#f43f5e",
  defaultData: { language: "", code: "" },
  isText: false,
  renderEditor: ({ block, isActive, onChange, onFocus, onBlur }) => {
    const handleChange = useCallback(
      (patch: Partial<CodeData>) => onChange({ ...block.data, ...patch }),
      [block.data, onChange]
    )

    return (
      <div className="py-2 relative" onFocus={onFocus} onBlur={onBlur}>
        {block.data.language && (
          <div className="absolute top-4 right-3 text-[10px] uppercase tracking-wider text-[var(--visual-editor-text-dim)] font-mono">
            {block.data.language}
          </div>
        )}
        {isActive ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase tracking-wider text-[var(--visual-editor-text-dim)]">Language</label>
              <input
                type="text"
                value={block.data.language}
                onChange={(e) => handleChange({ language: e.target.value })}
                placeholder="e.g. python"
                className="w-32 bg-[var(--visual-editor-bg)] border border-[var(--visual-editor-toolbar-border)] rounded-md px-2 py-1 text-xs text-[var(--visual-editor-text)] outline-none focus:border-[var(--primary)]"
              />
            </div>
            <textarea
              value={block.data.code}
              onChange={(e) => handleChange({ code: e.target.value })}
              rows={6}
              className="w-full bg-[var(--visual-editor-bg)] border border-[var(--visual-editor-toolbar-border)] rounded-lg p-4 font-mono text-xs text-[var(--visual-editor-text)] resize-y outline-none focus:border-[var(--primary)]"
              placeholder="Paste code here..."
            />
          </div>
        ) : (
          <pre className="w-full bg-[var(--visual-editor-bg)] border border-[var(--visual-editor-toolbar-border)] rounded-lg p-4 font-mono text-xs text-[var(--visual-editor-text)] overflow-x-auto">
            <code>{block.data.code || " "}</code>
          </pre>
        )}
      </div>
    )
  },
  toLaTeX: (data) => {
    const opts = data.language ? `[language=${data.language}]` : ""
    return `\\begin{lstlisting}${opts}\n${data.code}\n\\end{lstlisting}`
  },
}
