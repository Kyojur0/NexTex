"use client"

import { Heading1 } from "lucide-react"
import type { BlockPlugin } from "../types"

export interface SectionData {
  level: "section" | "subsection" | "subsubsection"
  title: string
}

export const sectionPlugin: BlockPlugin<SectionData> = {
  type: "section",
  label: "Section",
  icon: Heading1,
  defaultData: { level: "section", title: "New Section" },
  renderConfig: ({ block, onChange }) => (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Level</label>
        <select
          value={block.data.level}
          onChange={(e) =>
            onChange({ ...block.data, level: e.target.value as SectionData["level"] })
          }
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="section">Section</option>
          <option value="subsection">Subsection</option>
          <option value="subsubsection">Subsubsection</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Title</label>
        <input
          type="text"
          value={block.data.title}
          onChange={(e) => onChange({ ...block.data, title: e.target.value })}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Section title"
        />
      </div>
    </div>
  ),
  renderPreview: ({ block }) => {
    const sizeClass =
      block.data.level === "section"
        ? "text-lg"
        : block.data.level === "subsection"
        ? "text-base"
        : "text-sm"
    return (
      <h3 className={`font-semibold tracking-tight text-foreground ${sizeClass}`}>
        {block.data.title || <span className="italic text-muted-foreground">Untitled section</span>}
      </h3>
    )
  },
  toLaTeX: (data) => `\\${data.level}{${data.title.trim()}}`,
}
