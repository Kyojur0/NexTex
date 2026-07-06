"use client"

import { useCallback } from "react"
import { Image } from "lucide-react"
import { InlineText } from "../components/inline-text"
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
      <div className="py-2" onFocus={onFocus} onBlur={onBlur}>
        <div className="w-full h-40 bg-[var(--visual-editor-bg)] rounded-xl border border-dashed border-[var(--visual-editor-canvas-border)] flex items-center justify-center">
          <div className="flex flex-col items-center gap-1.5 text-[var(--visual-editor-text-dim)]">
            <Image className="h-8 w-8" />
            <span className="text-xs font-mono">{block.data.src || "image.png"}</span>
          </div>
        </div>

        {isActive && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-[var(--visual-editor-text-dim)]">Image filename</label>
              <input
                type="text"
                value={block.data.src}
                onChange={(e) => handleChange({ src: e.target.value })}
                placeholder="image.png"
                className="w-full mt-1 bg-[var(--visual-editor-bg)] border border-[var(--visual-editor-toolbar-border)] rounded-md px-2 py-1 text-sm text-[var(--visual-editor-text)] outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-[var(--visual-editor-text-dim)]">Caption</label>
              <input
                type="text"
                value={block.data.caption}
                onChange={(e) => handleChange({ caption: e.target.value })}
                placeholder="Figure caption"
                className="w-full mt-1 bg-[var(--visual-editor-bg)] border border-[var(--visual-editor-toolbar-border)] rounded-md px-2 py-1 text-sm text-[var(--visual-editor-text)] outline-none focus:border-[var(--primary)]"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[var(--visual-editor-text-dim)]">Width</label>
              <input
                type="text"
                value={block.data.width}
                onChange={(e) => handleChange({ width: e.target.value })}
                placeholder="0.8"
                className="w-full mt-1 bg-[var(--visual-editor-bg)] border border-[var(--visual-editor-toolbar-border)] rounded-md px-2 py-1 text-sm text-[var(--visual-editor-text)] outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>
        )}

        {!isActive && block.data.caption && (
          <p className="mt-2 text-sm text-center italic text-[var(--visual-editor-text-dim)] font-serif">
            {block.data.caption}
          </p>
        )}
      </div>
    )
  },
  toLaTeX: (data) =>
    `\\begin{figure}[h]\n\\centering\n\\includegraphics[width=${data.width}\\textwidth]{${data.src || "image.png"}}\n\\caption{${data.caption}}\n\\end{figure}`,
}
