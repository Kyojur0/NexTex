"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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

function EditorInner() {
  const store = useEditorStore()
  const {
    files,
    activeFileId,
    activeFilePath,
    content,
    isModified,
    isBuilding,
    showBuildLog,
    showTemplateModal,
    showSettings,
    showPreview,
    showHistory,
    showAISpotlight,
    sidebarWidth,
    isDragging,
    settings,
    buildLogs,
    pdfUrl,
    workspaceRoot,
    setContent,
    setIsModified,
    setShowBuildLog,
    setShowTemplateModal,
    setShowSettings,
    setShowPreview,
    setShowHistory,
    setShowAISpotlight,
    setSidebarWidth,
    setIsDragging,
    loadWorkspace,
    selectWorkspace,
    openFile,
    saveActiveFile,
    compileActiveFile,
    refreshFiles,
  } = store

  const [mounted, setMounted] = useState(false)
  const [showOpenFolder, setShowOpenFolder] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [splitRatio, setSplitRatio] = useState(0.55)
  const splitDragging = useRef(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  // Initialize on mount
  useEffect(() => {
    setMounted(true)
    let cancelled = false
    async function init() {
      try {
        await loadWorkspace()
        if (cancelled) return
        // Open first .tex file if available
        const tree = await api.fetchFileTree("")
        const firstTex = findFirstTexFile(tree)
        if (firstTex && !cancelled) {
          await openFile(firstTex.id, firstTex.path)
        }
      } catch (e) {
        console.error("Failed to initialize workspace", e)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [loadWorkspace, openFile])

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
    const handleMouseUp = () => { splitDragging.current = false }
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [])

  // File select with unsaved guard
  const handleFileSelect = useCallback(async (fileId: string, filePath: string) => {
    if (isModified && activeFilePath) {
      // Auto-save on switch to prevent silent loss
      await saveActiveFile()
    }
    await openFile(fileId, filePath)
  }, [isModified, activeFilePath, saveActiveFile, openFile])

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    setIsModified(true)
  }, [setContent, setIsModified])

  const handleSave = useCallback(async () => {
    await saveActiveFile()
    if (settings.buildOnSave && activeFilePath) {
      await compileActiveFile()
    }
  }, [saveActiveFile, settings.buildOnSave, activeFilePath, compileActiveFile])

  const handleBuild = useCallback(async () => {
    if (!activeFilePath) return
    if (isModified) {
      await saveActiveFile()
    }
    await compileActiveFile()
  }, [activeFilePath, isModified, saveActiveFile, compileActiveFile])

  // Autosave
  useEffect(() => {
    if (!settings.autoSave || !isModified || !activeFilePath) return
    const timer = setTimeout(() => {
      saveActiveFile()
      if (settings.buildOnSave) {
        compileActiveFile()
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [content, isModified, activeFilePath, settings.autoSave, settings.buildOnSave, saveActiveFile, compileActiveFile])

  const handleJumpToLine = useCallback((line: number) => {
    window.dispatchEvent(new CustomEvent("editor:jump-to-line", { detail: { line } }))
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave() }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") { e.preventDefault(); handleBuild() }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowAISpotlight(true) }
      if (e.key === "Escape") { setShowAISpotlight(false) }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSave, handleBuild, setShowAISpotlight])

  if (!mounted) return null

  const activeFileName = activeFilePath ? activeFilePath.split("/").pop() || "Untitled" : "Untitled"

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

        {/* Left sidebar: file tree or version history */}
        <div style={{ width: `${sidebarWidth}px` }} className={cn("flex flex-col border-r border-border shrink-0 overflow-hidden", isDragging && "select-none")}>
          {showHistory ? (
            <VersionHistory onClose={() => setShowHistory(false)} />
          ) : (
            <FileTree
              files={files}
              activeFileId={activeFileId}
              onFileSelect={handleFileSelect}
              onShowHistory={() => setShowHistory(true)}
            />
          )}
        </div>

        {/* Sidebar resize handle */}
        <div
          onMouseDown={handleSidebarMouseDown}
          className={cn("w-1 bg-border hover:bg-primary/30 cursor-col-resize transition-colors shrink-0", isDragging && "bg-primary/40")}
        />

        {/* Editor + Preview horizontal split */}
        <div ref={splitContainerRef} className="flex-1 flex overflow-hidden">
          {/* Code editor */}
          <div style={{ width: showPreview ? `${splitRatio * 100}%` : "100%" }} className="flex flex-col overflow-hidden transition-all duration-200 p-3">
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Loading workspace...
              </div>
            ) : (
              <EnhancedCodeEditor
                content={content}
                onChange={handleContentChange}
                fileName={activeFileName}
                fontSize={settings.fontSize}
                tabSize={settings.tabSize}
                enableSyntaxHighlight={settings.enableSyntaxHighlight}
                wordWrap={settings.wordWrap}
                onAISpotlight={() => setShowAISpotlight(true)}
              />
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
              <PdfPreview
                fileName={activeFileName.replace(".tex", ".pdf")}
                pdfUrl={pdfUrl}
                isBuilding={isBuilding}
              />
            </div>
          )}
        </div>
      </div>

      {/* Smart Terminal - collapsible bottom panel */}
      <SmartTerminal
        logs={buildLogs}
        isBuilding={isBuilding}
        isOpen={showBuildLog}
        onToggle={() => setShowBuildLog(!showBuildLog)}
        onJumpToLine={handleJumpToLine}
      />

      {/* AI Spotlight modal */}
      {showAISpotlight && (
        <AISpotlight
          selectedCode={content}
          currentContent={content}
          onAccept={(newContent) => {
            handleContentChange(newContent)
            setShowAISpotlight(false)
          }}
          onClose={() => setShowAISpotlight(false)}
          aiModel={settings.aiModel}
        />
      )}

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
