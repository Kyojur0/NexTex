"use client"

import { memo } from "react"
import { useEditorStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { FileCode, LayoutTemplate } from "lucide-react"

export const EditorTabBar = memo(function EditorTabBar() {
  const activeTab = useEditorStore((s) => s.activeEditorTab)
  const setActiveEditorTab = useEditorStore((s) => s.setActiveEditorTab)

  return (
    <div className="flex items-center justify-end gap-1 pb-2 border-b border-border/60">
      <div className="inline-flex items-center bg-muted/60 rounded-lg p-[3px] gap-[2px]">
        <button
          onClick={() => setActiveEditorTab("text")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
            activeTab === "text"
              ? "bg-background text-foreground shadow-sm border border-border/50"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <FileCode className="h-3.5 w-3.5" />
          Text Editor
        </button>
        <button
          onClick={() => setActiveEditorTab("visual")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
            activeTab === "visual"
              ? "bg-background text-foreground shadow-sm border border-border/50"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Visual Editor
        </button>
      </div>
    </div>
  )
})
