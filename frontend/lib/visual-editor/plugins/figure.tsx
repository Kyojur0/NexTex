"use client"

import { Image } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  color: "#0ea5e9",
  defaultData: { src: "image.png", caption: "Figure caption", width: "0.8" },
  renderConfig: ({ block, onChange }) => (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Image filename</Label>
        <Input
          type="text"
          value={block.data.src}
          onChange={(e) => onChange({ ...block.data, src: e.target.value })}
          placeholder="image.png"
          className="text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Caption</Label>
        <Input
          type="text"
          value={block.data.caption}
          onChange={(e) => onChange({ ...block.data, caption: e.target.value })}
          placeholder="Figure caption"
          className="text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Width (fraction of text width)</Label>
        <Input
          type="text"
          value={block.data.width}
          onChange={(e) => onChange({ ...block.data, width: e.target.value })}
          placeholder="0.8"
          className="text-sm"
        />
      </div>
    </div>
  ),
  renderPreview: ({ block }) => (
    <div className="flex flex-col items-center gap-2 py-3">
      <div className="w-full h-32 bg-muted/30 rounded-xl border border-dashed border-border/60 flex items-center justify-center">
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
