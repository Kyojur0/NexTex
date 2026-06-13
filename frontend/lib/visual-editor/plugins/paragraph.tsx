"use client"

import { Type } from "lucide-react"
import type { BlockPlugin } from "../types"

export interface ParagraphData {
  text: string
}

export const paragraphPlugin: BlockPlugin<ParagraphData> = {
  type: "paragraph",
  label: "Paragraph",
  icon: Type,
  defaultData: { text: "Enter your text here..." },
  renderConfig: ({ block, onChange }) => (
    <textarea
      value={block.data.text}
      onChange={(e) => onChange({ ...block.data, text: e.target.value })}
      rows={4}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-sans resize-y focus:outline-none focus:ring-2 focus:ring-ring"
      placeholder="Type paragraph text..."
    />
  ),
  renderPreview: ({ block }) => (
    <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
      {block.data.text || <span className="italic text-muted-foreground">Empty paragraph</span>}
    </p>
  ),
  toLaTeX: (data) => data.text.trim(),
}
