"use client"

import { Type } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import type { BlockPlugin } from "../types"

export interface ParagraphData {
  text: string
}

export const paragraphPlugin: BlockPlugin<ParagraphData> = {
  type: "paragraph",
  label: "Paragraph",
  icon: Type,
  color: "#64748b",
  defaultData: { text: "Enter your text here..." },
  renderConfig: ({ block, onChange }) => (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Text</Label>
      <Textarea
        value={block.data.text}
        onChange={(e) => onChange({ ...block.data, text: e.target.value })}
        rows={4}
        className="resize-y text-sm"
        placeholder="Type paragraph text..."
      />
    </div>
  ),
  renderPreview: ({ block }) => (
    <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">
      {block.data.text || <span className="italic text-muted-foreground/70">Empty paragraph</span>}
    </p>
  ),
  toLaTeX: (data) => data.text.trim(),
}
