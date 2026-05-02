"use client"

import { useCallback, useEffect, useRef, useState, memo } from "react"
import { ThemeProvider } from "next-themes"
import { Header } from "@/components/editor/header"
import { FileTree } from "@/components/editor/file-tree"
import { EnhancedCodeEditor } from "@/components/editor/enhanced-code-editor"
import { PdfPreview } from "@/components/editor/pdf-preview"
import { SmartTerminal } from "@/components/editor/smart-terminal"
import { TemplateModal } from "@/components/editor/template-modal"
import { AdvancedSettings } from "@/components/editor/advanced-settings"
import { LayoutWrapper } from "@/components/editor/layout-wrapper"
import { VersionHistory } from "@/components/editor/version-history"
import { AISpotlight } from "@/components/editor/ai-spotlight"
import { ColorPaletteProvider } from "@/lib/color-palette-context"
import { useEditorStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, FolderOpen } from "lucide-react"
import * as api from "@/lib/api"

function findFirstTexFile(nodes: api.FileNode[]): api.FileNode | null {
  for (const node of nodes) {
    if (node.type === "file" && node.name.endsWith(".tex")) return node
    if (node.children) {
      const found = findFirstTexFile(node.children)
      if (found) return found
    }
  }
  return null
}

function OpenFolderDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (path: string, trusted: boolean) => Promise<void>
}) {
  const [path, setPath] = useState("")
  const [needsTrust, setNeedsTrust] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTrySelect = async (trusted: boolean) => {
    setLoading(true)
    setError(null)
    try {
      await onSelect(path.trim(), trusted)
      setPath("")
      setNeedsTrust(false)
      onOpenChange(false)
    } catch (err: any) {
      const msg = err?.message || ""
      if (!trusted && msg.toLowerCase().includes("trusted")) {
        setNeedsTrust(true)
      } else {
        setError(msg || "Failed to open folder")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!path.trim()) return
    handleTrySelect(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setNeedsTrust(false); setError(null); setPath("") } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Open Local Folder
          </DialogTitle>
          <DialogDescription>
            Enter the absolute path to a local folder you want to edit.
          </DialogDescription>
        </DialogHeader>

        {!needsTrust ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-path">Folder path</Label>
              <Input
                id="folder-path"
                placeholder="/Users/you/Documents/project"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !path.trim()}>
                {loading ? "Opening..." : "Open Folder"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                    Trust Required
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    This folder is outside the default workspace. Enabling trusted local mode allows the app to read and write files in this location. Only proceed if you trust this folder.
                  </p>
                </div>
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setNeedsTrust(false)}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleTrySelect(true)}
                disabled={loading}
              >
                {loading ? "Opening..." : "Trust and Open"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Isolated sub-components to prevent cascade re-renders
// ---------------------------------------------------------------------------

const EditorPane = memo(function EditorPane() {
  const content = useEditorStore((s) => s.content)
  const settings = useEditorStore((s) => s.settings)
  const activeFilePath = useEditorStore((s) => s.activeFilePath)

  const fileName = activeFilePath ? activeFilePath.split("/").pop() || "Untitled" : "Untitled"

  const handleChange = useCallback((newContent: string) => {
    const state = useEditorStore.getState()
    state.setContent(newContent)
    state.setIsModified(true)
  }, [])

  return (
    <EnhancedCodeEditor
      content={content}
      onChange={handleChange}
      fileName={fileName}
      fontSize={settings.fontSize}
      tabSize={settings.tabSize}
      enableSyntaxHighlight={settings.enableSyntaxHighlight}
      wordWrap={settings.wordWrap}
      onAISpotlight={() => useEditorStore.getState().setShowAISpotlight(true)}
    />
  )
})

const PreviewPane = memo(function PreviewPane() {
  const pdfUrl = useEditorStore((s) => s.pdfUrl)
  const isBuilding = useEditorStore((s) => s.isBuilding)
  const activeFilePath = useEditorStore((s) => s.activeFilePath)

  const fileName = activeFilePath
    ? (activeFilePath.split("/").pop()?.replace(".tex", ".pdf") || "document.pdf")
    : "document.pdf"

  return (
    <PdfPreview
      fileName={fileName}
      pdfUrl={pdfUrl}
      isBuilding={isBuilding}
    />
  )
})

const TerminalPane = memo(function TerminalPane() {
  const logs = useEditorStore((s) => s.buildLogs)
  const isBuilding = useEditorStore((s) => s.isBuilding)
  const isOpen = useEditorStore((s) => s.showBuildLog)

  const handleJumpToLine = useCallback((line: number) => {
    window.dispatchEvent(new CustomEvent("editor:jump-to-line", { detail: { line } }))
  }, [])

  const handleToggle = useCallback(() => {
    const state = useEditorStore.getState()
    state.setShowBuildLog(!state.showBuildLog)
  }, [])

  return (
    <SmartTerminal
      logs={logs}
      isBuilding={isBuilding}
      isOpen={isOpen}
      onToggle={handleToggle}
      onJumpToLine={handleJumpToLine}
    />
  )
})

const SidebarPane = memo(function SidebarPane({
  width,
  showHistory,
  onShowHistory,
  onFileSelect,
}: {
  width: number
  showHistory: boolean
  onShowHistory: () => void
  onFileSelect: (id: string, path: string) => void
}) {
  const files = useEditorStore((s) => s.files)
  const activeFileId = useEditorStore((s) => s.activeFileId)

  return (
    <div
      style={{ width: `${width}px` }}
      className="flex flex-col border-r border-border shrink-0 overflow-hidden"
    >
      {showHistory ? (
        <VersionHistory onClose={() => useEditorStore.getState().setShowHistory(false)} />
      ) : (
        <FileTree
          files={files}
          activeFileId={activeFileId}
          onFileSelect={onFileSelect}
          onShowHistory={onShowHistory}
        />
      )}
    </div>
  )
})

const AISpotlightPane = memo(function AISpotlightPane() {
  const content = useEditorStore((s) => s.content)
  const aiModel = useEditorStore((s) => s.settings.aiModel)

  const handleAccept = useCallback((newContent: string) => {
    const state = useEditorStore.getState()
    state.setContent(newContent)
    state.setIsModified(true)
    state.setShowAISpotlight(false)
  }, [])

  const handleClose = useCallback(() => {
    useEditorStore.getState().setShowAISpotlight(false)
  }, [])

  return (
    <AISpotlight
      selectedCode={content}
      currentContent={content}
      onAccept={handleAccept}
      onClose={handleClose}
      aiModel={aiModel}
    />
  )
})

// ---------------------------------------------------------------------------
// Main layout shell
// ---------------------------------------------------------------------------

function EditorInner() {
  // Only subscribe to layout-level state that changes rarely
  const showPreview = useEditorStore((s) => s.showPreview)
  const showHistory = useEditorStore((s) => s.showHistory)
  const showTemplateModal = useEditorStore((s) => s.showTemplateModal)
  const showSettings = useEditorStore((s) => s.showSettings)
  const showAISpotlight = useEditorStore((s) => s.showAISpotlight)
  const sidebarWidth = useEditorStore((s) => s.sidebarWidth)
  const isDragging = useEditorStore((s) => s.isDragging)

  const setSidebarWidth = useEditorStore((s) => s.setSidebarWidth)
  const setIsDragging = useEditorStore((s) => s.setIsDragging)
  const setShowPreview = useEditorStore((s) => s.setShowPreview)
  const setShowTemplateModal = useEditorStore((s) => s.setShowTemplateModal)
  const setShowSettings = useEditorStore((s) => s.setShowSettings)
  const setShowAISpotlight = useEditorStore((s) => s.setShowAISpotlight)
  const selectWorkspace = useEditorStore((s) => s.selectWorkspace)

  const [mounted, setMounted] = useState(false)
  const [showOpenFolder, setShowOpenFolder] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [splitRatio, setSplitRatio] = useState(0.55)
  const splitDragging = useRef(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  // Initialize on mount
  useEffect(() => {
    setMounted(true)
    const state = useEditorStore.getState()
    state
      .loadWorkspace()
      .then(async () => {
        const tree = await api.fetchFileTree("")
        const firstTex = findFirstTexFile(tree)
        if (firstTex) {
          await state.openFile(firstTex.id, firstTex.path)
          console.log("[NexTex] Opened first .tex file:", firstTex.path)
        } else {
          console.warn("[NexTex] No .tex files found in workspace")
        }
      })
      .catch((e) => {
        console.error("[NexTex] Failed to initialize workspace:", e)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  // Keyboard shortcuts - stable, only registered once
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useEditorStore.getState()
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        state.saveActiveFile().catch((err: any) => {
          console.error("[NexTex] Save failed:", err)
        })
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault()
        console.log("[NexTex] Build shortcut triggered")
        state.compileActiveFile().catch((err: any) => {
          console.error("[NexTex] Build failed:", err)
        })
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        state.setShowAISpotlight(true)
      }
      if (e.key === "Escape") {
        state.setShowAISpotlight(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Autosave effect - reads current state inside timer to keep deps stable
  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, prevState) => {
      // Only react to content changes when auto-save is on
      if (
        state.content !== prevState.content &&
        state.isModified &&
        state.activeFilePath &&
        state.settings.autoSave
      ) {
        // Debounce via a module-level timer would be cleaner,
        // but for simplicity we use a local ref timer inside the subscriber.
      }
    })
    return () => unsubscribe()
  }, [])

  // Debounced autosave using a ref timer
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state) => {
      if (!state.settings.autoSave || !state.isModified || !state.activeFilePath) {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current)
          autoSaveTimerRef.current = null
        }
        return
      }
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
      autoSaveTimerRef.current = setTimeout(() => {
        const current = useEditorStore.getState()
        if (current.isModified && current.activeFilePath) {
          current.saveActiveFile().then(() => {
            if (current.settings.buildOnSave) {
              current.compileActiveFile()
            }
          }).catch((err: any) => {
            console.error("[NexTex] Auto-save failed:", err)
          })
        }
        autoSaveTimerRef.current = null
      }, 2000)
    })
    return () => {
      unsubscribe()
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  // Sidebar resize
  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    e.preventDefault()
  }, [setIsDragging])

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => {
      setSidebarWidth(Math.max(150, Math.min(500, e.clientX)))
    }
    const handleMouseUp = () => setIsDragging(false)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, setSidebarWidth, setIsDragging])

  // Horizontal editor/preview split resize
  const handleSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    splitDragging.current = true
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!splitDragging.current || !splitContainerRef.current) return
      const rect = splitContainerRef.current.getBoundingClientRect()
      const newRatio = Math.max(0.25, Math.min(0.8, (e.clientX - rect.left) / rect.width))
      setSplitRatio(newRatio)
    }
    const handleMouseUp = () => {
      splitDragging.current = false
    }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [])

  // Stable callbacks passed to Header
  const handleSave = useCallback(async () => {
    const state = useEditorStore.getState()
    await state.saveActiveFile()
    if (state.settings.buildOnSave && state.activeFilePath) {
      await state.compileActiveFile()
    }
  }, [])

  const handleBuild = useCallback(async () => {
    const state = useEditorStore.getState()
    if (!state.activeFilePath) {
      console.warn("[NexTex] Build skipped: no active file")
      return
    }
    console.log("[NexTex] Build started for:", state.activeFilePath)
    if (state.isModified) {
      await state.saveActiveFile()
    }
    await state.compileActiveFile()
  }, [])

  const handleFileSelect = useCallback(async (fileId: string, filePath: string) => {
    const state = useEditorStore.getState()
    if (state.isModified && state.activeFilePath) {
      await state.saveActiveFile()
    }
    await state.openFile(fileId, filePath)
  }, [])

  const handleJumpToLine = useCallback((line: number) => {
    window.dispatchEvent(new CustomEvent("editor:jump-to-line", { detail: { line } }))
  }, [])

  if (!mounted) return null

  return (
    <LayoutWrapper>
      <Header
        onOpenFolder={() => setShowOpenFolder(true)}
        onOpenFile={() => {}}
        onSave={handleSave}
        onSaveAs={() => {}}
        onBuild={handleBuild}
        onNewFromTemplate={() => setShowTemplateModal(true)}
        onOpenSettings={() => setShowSettings(true)}
        onTogglePreview={() => setShowPreview(!showPreview)}
        showPreview={showPreview}
      />

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        <SidebarPane
          width={sidebarWidth}
          showHistory={showHistory}
          onShowHistory={() => useEditorStore.getState().setShowHistory(true)}
          onFileSelect={handleFileSelect}
        />

        {/* Sidebar resize handle */}
        <div
          onMouseDown={handleSidebarMouseDown}
          className={cn(
            "w-1 bg-border hover:bg-primary/30 cursor-col-resize transition-colors shrink-0",
            isDragging && "bg-primary/40"
          )}
        />

        {/* Editor + Preview horizontal split */}
        <div ref={splitContainerRef} className="flex-1 flex overflow-hidden">
          {/* Code editor */}
          <div
            style={{ width: showPreview ? `${splitRatio * 100}%` : "100%" }}
            className="flex flex-col overflow-hidden transition-all duration-200 p-3"
          >
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Loading workspace...
              </div>
            ) : (
              <EditorPane />
            )}
          </div>

          {/* Horizontal divider (only when preview visible) */}
          {showPreview && (
            <div
              onMouseDown={handleSplitMouseDown}
              className="w-1 bg-border hover:bg-primary/30 cursor-col-resize transition-colors shrink-0"
            />
          )}

          {/* PDF preview */}
          {showPreview && (
            <div style={{ width: `${(1 - splitRatio) * 100}%` }} className="flex flex-col overflow-hidden p-3">
              <PreviewPane />
            </div>
          )}
        </div>
      </div>

      {/* Smart Terminal - collapsible bottom panel */}
      <TerminalPane />

      {/* AI Spotlight modal */}
      {showAISpotlight && <AISpotlightPane />}

      {/* Modals */}
      <TemplateModal open={showTemplateModal} onOpenChange={setShowTemplateModal} />
      <AdvancedSettings open={showSettings} onOpenChange={setShowSettings} />
      <OpenFolderDialog
        open={showOpenFolder}
        onOpenChange={setShowOpenFolder}
        onSelect={async (path, trusted) => {
          await selectWorkspace(path, trusted)
        }}
      />
    </LayoutWrapper>
  )
}

export default function EditorPage() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <ColorPaletteProvider>
        <EditorInner />
      </ColorPaletteProvider>
    </ThemeProvider>
  )
}
