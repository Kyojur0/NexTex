"use client"

import { useCallback } from "react"
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
  defaultData: { language: "", code: "" },
  isText: false,
  renderEditor: ({ block, isActive, onChange, onFocus, onBlur }) => {
    const handleChange = useCallback(
      (patch: Partial<CodeData>) => onChange({ ...block.data, ...patch }),
      [block.data, onChange]
    )

    return (
      <div className="space-y-2" onFocus={onFocus} onBlur={onBlur}>
        {isActive && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Language</Label>
            <Input
              value={block.data.language}
              onChange={(e) => handleChange({ language: e.target.value })}
              placeholder="e.g. python"
              className="h-7 text-xs w-32"
            />
          </div>
        )}
        <Textarea
          value={block.data.code}
          onChange={(e) => handleChange({ code: e.target.value })}
          rows={isActive ? 6 : 3}
          className="font-mono text-xs resize-y bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/20"
          placeholder="Paste code here..."
        />
      </div>
    )
  },
  toLaTeX: (data) => {
    const opts = data.language ? `[language=${data.language}]` : ""
    return `\\begin{lstlisting}${opts}\n${data.code}\n\\end{lstlisting}`
  },
}
