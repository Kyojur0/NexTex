"use client"

import { Image } from "lucide-react"
import type { BlockPlugin } from "../types"

export interface FigureData {
  src: string
  caption: string
  width: string
}

export const figurePlugin: BlockPlugin<FigureData> = {
  type: "figure",
  label: "Figure",
  icon: Image,
  defaultData: { src: "image.png", caption: "Figure caption", width: "0.8" },
  renderConfig: ({ block, onChange }) => (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Image filename</label>
        <input
          type="text"
          value={block.data.src}
          onChange={(e) => onChange({ ...block.data, src: e.target.value })}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="image.png"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Caption</label>
        <input
          type="text"
          value={block.data.caption}
          onChange={(e) => onChange({ ...block.data, caption: e.target.value })}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Figure caption"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Width (fraction of text width)</label>
        <input
          type="text"
          value={block.data.width}
          onChange={(e) => onChange({ ...block.data, width: e.target.value })}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="0.8"
        />
      </div>
    </div>
  ),
  renderPreview: ({ block }) => (
    <div className="flex flex-col items-center gap-2 py-3">
      <div className="w-full h-32 bg-muted/30 rounded-md border border-dashed border-border/60 flex items-center justify-center">
        <div className="flex flex-col items-center gap-1.5 text-muted-foreground/50">
          <Image className="h-8 w-8" />
          <span className="text-xs">{block.data.src || "image.png"}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground italic">
        {block.data.caption || <span className="italic">No caption</span>}
      </span>
    </div>
  ),
  toLaTeX: (data) =>
    `\\begin{figure}[h]\n\\centering\n\\includegraphics[width=${data.width}\\textwidth]{${data.src}}\n\\caption{${data.caption}}\n\\end{figure}`,
}
