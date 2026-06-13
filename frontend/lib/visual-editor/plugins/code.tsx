"use client"

import { Code } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { BlockPlugin } from "../types"

export interface CodeData {
  language: string
  code: string
}

export const codePlugin: BlockPlugin<CodeData> = {
  type: "code",
  label: "Code",
  icon: Code,
  color: "#f43f5e",
  defaultData: { language: "", code: "console.log(\"hello\")" },
  renderConfig: ({ block, onChange }) => (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Language (optional)</Label>
        <Input
          type="text"
          value={block.data.language}
          onChange={(e) => onChange({ ...block.data, language: e.target.value })}
          placeholder="e.g. python"
          className="text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Code</Label>
        <Textarea
          value={block.data.code}
          onChange={(e) => onChange({ ...block.data, code: e.target.value })}
          rows={6}
          className="font-mono text-sm resize-y"
          placeholder="Paste code here..."
        />
      </div>
    </div>
  ),
  renderPreview: ({ block }) => (
    <div className="bg-muted/40 rounded-xl p-3 overflow-x-auto">
      <pre className="font-mono text-xs text-foreground/80 whitespace-pre">
        <code>{block.data.code || <span className="italic text-muted-foreground/70">Empty code block</span>}</code>
      </pre>
    </div>
  ),
  toLaTeX: (data) => {
    const opts = data.language ? `[language=${data.language}]` : ""
    return `\\begin{lstlisting}${opts}\n${data.code}\n\\end{lstlisting}`
  },
}
