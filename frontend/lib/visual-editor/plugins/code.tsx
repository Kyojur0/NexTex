"use client"

import { Code } from "lucide-react"
import type { BlockPlugin } from "../types"

export interface CodeData {
  language: string
  code: string
}

export const codePlugin: BlockPlugin<CodeData> = {
  type: "code",
  label: "Code",
  icon: Code,
  defaultData: { language: "", code: "console.log(\"hello\")" },
  renderConfig: ({ block, onChange }) => (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Language (optional)</label>
        <input
          type="text"
          value={block.data.language}
          onChange={(e) => onChange({ ...block.data, language: e.target.value })}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g. python"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Code</label>
        <textarea
          value={block.data.code}
          onChange={(e) => onChange({ ...block.data, code: e.target.value })}
          rows={6}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Paste code here..."
        />
      </div>
    </div>
  ),
  renderPreview: ({ block }) => (
    <div className="bg-muted/40 rounded-md p-3 overflow-x-auto">
      <pre className="font-mono text-xs text-foreground/80 whitespace-pre">
        <code>{block.data.code || <span className="italic text-muted-foreground">Empty code block</span>}</code>
      </pre>
    </div>
  ),
  toLaTeX: (data) => {
    const opts = data.language ? `[language=${data.language}]` : ""
    return `\\begin{lstlisting}${opts}\n${data.code}\n\\end{lstlisting}`
  },
}
