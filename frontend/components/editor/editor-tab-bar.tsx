"use client"

import { memo } from "react"
import { useEditorStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { FileCode, LayoutTemplate } from "lucide-react"

export const EditorTabBar = memo(function EditorTabBar() {
  const activeTab = useEditorStore((s) => s.activeEditorTab)
  const setActiveEditorTab = useEditorStore((s) => s.setActiveEditorTab)

  return (
    <div className="flex items-center justify-end pb-3">
      <div className="inline-flex items-center bg-muted/70 rounded-xl p-1 gap-1">
        <TabButton
          testId="text-editor-tab"
          isActive={activeTab === "text"}
          onClick={() => setActiveEditorTab("text")}
          icon={<FileCode className="h-3.5 w-3.5" />}
          label="Text"
        />
        <TabButton
          testId="visual-editor-tab"
          isActive={activeTab === "visual"}
          onClick={() => setActiveEditorTab("visual")}
          icon={<LayoutTemplate className="h-3.5 w-3.5" />}
          label="Visual"
        />
      </div>
    </div>
  )
})

function TabButton({
  testId,
  isActive,
  onClick,
  icon,
  label,
}: {
  testId: string
  isActive: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-200",
        isActive
          ? "bg-background text-foreground shadow-elevated"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
      )}
    >
      {icon}
      {label}
    </button>
  )
}
