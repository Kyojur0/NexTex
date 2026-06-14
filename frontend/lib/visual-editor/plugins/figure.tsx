"use client"

import { useCallback } from "react"
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
  defaultData: { src: "", caption: "", width: "0.8" },
  isText: false,
  renderEditor: ({ block, isActive, onChange, onFocus, onBlur }) => {
    const handleChange = useCallback(
      (patch: Partial<FigureData>) => onChange({ ...block.data, ...patch }),
      [block.data, onChange]
    )

    return (
      <div className="space-y-3" onFocus={onFocus} onBlur={onBlur}>
        <div className="w-full h-32 bg-muted/30 rounded-xl border border-dashed border-border/60 flex items-center justify-center">
          <div className="flex flex-col items-center gap-1.5 text-muted-foreground/50">
            <Image className="h-8 w-8" />
            <span className="text-xs">{block.data.src || "image.png"}</span>
          </div>
        </div>
        {isActive && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs text-muted-foreground">Image filename</Label>
              <Input
                value={block.data.src}
                onChange={(e) => handleChange({ src: e.target.value })}
                placeholder="image.png"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs text-muted-foreground">Caption</Label>
              <Input
                value={block.data.caption}
                onChange={(e) => handleChange({ caption: e.target.value })}
                placeholder="Figure caption"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Width</Label>
              <Input
                value={block.data.width}
                onChange={(e) => handleChange({ width: e.target.value })}
                placeholder="0.8"
                className="text-sm"
              />
            </div>
          </div>
        )}
        {!isActive && block.data.caption && (
          <p className="text-xs text-center text-muted-foreground italic">{block.data.caption}</p>
        )}
      </div>
    )
  },
  toLaTeX: (data) =>
    `\\begin{figure}[h]\n\\centering\n\\includegraphics[width=${data.width}\\textwidth]{${data.src || "image.png"}}\n\\caption{${data.caption}}\n\\end{figure}`,
}
