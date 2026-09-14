"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, memo } from "react"
import { ThemeProvider } from "next-themes"
import { Header } from "@/components/editor/header"
import { FileTree } from "@/components/editor/file-tree"
import { EnhancedCodeEditor } from "@/components/editor/enhanced-code-editor"
import { EditorTabBar } from "@/components/editor/editor-tab-bar"
import { VisualEditor } from "@/components/editor/visual-editor"
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
import { AlertTriangle, FolderOpen, PanelLeftClose } from "lucide-react"
import * as api from "@/lib/api"
import { FileDialogs, type FileDialogMode } from '@/components/editor/file-dialogs'
import { useDocumentLifecycle } from '@/hooks/use-document-lifecycle'
import { useEditorBridge } from '@/hooks/use-editor-bridge'
import { Toaster, toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'

const subscribeHydration = () => () => {}
const clientReady = () => true
const serverReady = () => false

function reportError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Operation failed'
  useEditorStore.getState().setLastError(message)
  toast.error(message)
}

function DocumentStatus({ onSaveAs }: { onSaveAs: () => void }) {
  const error = useEditorStore((s) => s.lastError)
  const draft = useEditorStore((s) => s.pendingDraft)
  const saving = useEditorStore((s) => s.isSaving)
  const navigating = useEditorStore((s) => s.isNavigating)
  const modified = useEditorStore((s) => s.isModified)
  const path = useEditorStore((s) => s.activeFilePath)
  return <div className="shrink-0 border-b border-border/40 px-3 py-1.5 text-xs flex flex-wrap items-center gap-2" role="status">
    <span className="text-muted-foreground mr-auto">{navigating ? 'Opening files…' : saving ? 'Saving…' : modified ? 'Unsaved changes' : path ? 'Saved to disk' : 'Open or create a document to get started'}</span>
    {draft && <><span>A recoverable draft is available.</span>
      <Button size="sm" variant="outline" onClick={() => useEditorStore.getState().restoreDraft()}>Recover draft</Button>
      <Button size="sm" variant="ghost" onClick={() => useEditorStore.getState().dismissDraft()}>Discard draft</Button></>}
    {error && <><span role="alert" className="text-destructive">{error}</span>
      <Button size="sm" variant="outline" onClick={onSaveAs}>Save a copy</Button>
      <Button size="sm" variant="outline" onClick={() => {
        if (window.confirm('Reload the file from disk? Unsaved changes in this editor will be discarded.'))
          void useEditorStore.getState().reloadActiveFile().catch(reportError)
      }}>Reload from disk</Button>
      <Button size="sm" variant="ghost" onClick={() => useEditorStore.getState().setLastError(null)}>Dismiss</Button></>}
  </div>
}

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
  const workspaceRoot = useEditorStore((s) => s.workspaceRoot)
  const errorLines = useEditorStore((s) => s.errorLines)

  const fileName = activeFilePath ? activeFilePath.split("/").pop() || "Untitled" : "Untitled"

  const handleChange = useCallback((newContent: string) => {
    const state = useEditorStore.getState()
    state.setContent(newContent)
  }, [])

  return (
    <EnhancedCodeEditor
      documentId={`${workspaceRoot}:${activeFilePath || 'untitled'}`}
      content={content}
      onChange={handleChange}
      fileName={fileName}
      fontSize={settings.fontSize}
      tabSize={settings.tabSize}
      enableSyntaxHighlight={settings.enableSyntaxHighlight}
      wordWrap={settings.wordWrap}
      onAISpotlight={() => useEditorStore.getState().setShowAISpotlight(true)}
      errorLines={errorLines.filter((diagnostic) => !diagnostic.file || diagnostic.file === activeFilePath)}
    />
  )
})

const PreviewPane = memo(function PreviewPane({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean
  onToggleCollapse: () => void
}) {
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
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
    />
  )
})

const TerminalPane = memo(function TerminalPane() {
  const logs = useEditorStore((s) => s.buildLogs)
  const diagnostics = useEditorStore((s) => s.errorLines)
  const isBuilding = useEditorStore((s) => s.isBuilding)
  const isOpen = useEditorStore((s) => s.showBuildLog)

  const handleJumpToLine = useCallback((line: number, file?: string) => {
    void (async () => {
      const state = useEditorStore.getState()
      if (file && file !== state.activeFilePath) await state.openFile(`file-${file}`, file)
      state.setActiveEditorTab('text')
      requestAnimationFrame(() => requestAnimationFrame(() => window.dispatchEvent(new CustomEvent("editor:jump-to-line", { detail: { line } }))))
    })().catch(reportError)
  }, [])

  const handleToggle = useCallback(() => {
    const state = useEditorStore.getState()
    state.setShowBuildLog(!state.showBuildLog)
  }, [])

  return (
    <SmartTerminal
      logs={logs}
      diagnostics={diagnostics}
      isBuilding={isBuilding}
      isOpen={isOpen}
      onToggle={handleToggle}
      onJumpToLine={handleJumpToLine}
    />
  )
})

const SidebarPane = memo(function SidebarPane({
  width,
  collapsed,
  showHistory,
  onShowHistory,
  onFileSelect,
  onExpand,
}: {
  width: number
  collapsed: boolean
  showHistory: boolean
  onShowHistory: () => void
  onFileSelect: (id: string, path: string) => void
  onExpand: () => void
}) {
  const files = useEditorStore((s) => s.files)
  const activeFileId = useEditorStore((s) => s.activeFileId)

  if (collapsed) {
    return (
      <div className="w-10 shrink-0 flex flex-col items-center py-2 border-r border-border/60 bg-sidebar/30">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-lg"
          onClick={onExpand}
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <PanelLeftClose className="h-4 w-4 rotate-180" />
        </Button>
      </div>
    )
  }

  return (
    <div
      style={{ width: `${width}px` }}
      className="flex flex-col border-r border-border/60 shrink-0 overflow-hidden bg-sidebar/30"
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
  const documentId = useEditorStore((s) => `${s.workspaceRoot}:${s.activeFilePath}`)
  const [selection] = useState(() => {
    const source = document.querySelector<HTMLTextAreaElement>('[data-testid="latex-source"]')
    return source && source.selectionEnd > source.selectionStart
      ? { range: { start: source.selectionStart, end: source.selectionEnd }, code: source.value.slice(source.selectionStart, source.selectionEnd) }
      : undefined
  })

  const handleAccept = useCallback((newContent: string) => {
    const state = useEditorStore.getState()
    state.setContent(newContent)
    state.setShowAISpotlight(false)
  }, [])

  const handleClose = useCallback(() => {
    useEditorStore.getState().setShowAISpotlight(false)
  }, [])

  return (
    <AISpotlight
      documentId={documentId}
      selectedCode={selection?.code || ''}
      selectedRange={selection?.range}
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
  useDocumentLifecycle()
  useEditorBridge()
  const isMobile = useIsMobile()
  // Only subscribe to layout-level state that changes rarely
  const showPreview = useEditorStore((s) => s.showPreview)
  const showHistory = useEditorStore((s) => s.showHistory)
  const showTemplateModal = useEditorStore((s) => s.showTemplateModal)
  const showSettings = useEditorStore((s) => s.showSettings)
  const showAISpotlight = useEditorStore((s) => s.showAISpotlight)
  const activeEditorTab = useEditorStore((s) => s.activeEditorTab)
  const sidebarWidth = useEditorStore((s) => s.sidebarWidth)
  const isDragging = useEditorStore((s) => s.isDragging)
  const isNavigating = useEditorStore((s) => s.isNavigating)
  const pendingDraft = useEditorStore((s) => s.pendingDraft)

  const setSidebarWidth = useEditorStore((s) => s.setSidebarWidth)
  const setIsDragging = useEditorStore((s) => s.setIsDragging)
  const setShowPreview = useEditorStore((s) => s.setShowPreview)
  const setShowTemplateModal = useEditorStore((s) => s.setShowTemplateModal)
  const setShowSettings = useEditorStore((s) => s.setShowSettings)
  const selectWorkspace = useEditorStore((s) => s.selectWorkspace)

  const mounted = useSyncExternalStore(subscribeHydration, clientReady, serverReady)
  const [showOpenFolder, setShowOpenFolder] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [fileDialog, setFileDialog] = useState<FileDialogMode>(null)
  const [splitRatio, setSplitRatio] = useState(0.55)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  const splitDragging = useRef(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)
  const initialized = useRef(false)

  // Initialize on mount
  useEffect(() => {
    // Strict Mode replays effects in development; initialize the workspace once.
    if (initialized.current) return
    initialized.current = true
    const state = useEditorStore.getState()
    state
      .loadWorkspace()
      .then(async () => {
        const tree = await api.fetchFileTree("")
        const firstTex = findFirstTexFile(tree)
        if (firstTex) {
          await state.openFile(firstTex.id, firstTex.path)
        }
      })
      .catch((e) => {
        reportError(new Error(`Could not connect to the local service. Start NexTex with npm run dev from the project root. ${e instanceof Error ? e.message : ''}`))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  // Keyboard shortcuts - stable, only registered once
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useEditorStore.getState()
      if (state.isNavigating || state.pendingDraft) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        if (e.shiftKey || !state.activeFilePath) setFileDialog('save-as')
        else void (state.settings.buildOnSave ? state.compileActiveFile() : state.saveActiveFile()).catch(reportError)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault()
        void state.compileActiveFile().catch(reportError)
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault(); setFileDialog('new')
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault(); if (e.shiftKey) setFileDialog('open'); else setShowOpenFolder(true)
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
    if (!state.activeFilePath) { setFileDialog('save-as'); return }
    await (state.settings.buildOnSave ? state.compileActiveFile() : state.saveActiveFile()).catch(reportError)
  }, [])

  const handleBuild = useCallback(async () => {
    const state = useEditorStore.getState()
    if (!state.activeFilePath) {
      return
    }
    await state.compileActiveFile().catch(reportError)
  }, [])

  const handleFileSelect = useCallback(async (fileId: string, filePath: string) => {
    const state = useEditorStore.getState()
    await state.openFile(fileId, filePath).catch(reportError)
  }, [])

  if (!mounted) return null

  return (
    <LayoutWrapper>
      <Header
        onNewFile={() => setFileDialog('new')}
        onOpenFolder={() => setShowOpenFolder(true)}
        onOpenFile={() => setFileDialog('open')}
        sidebarCollapsed={isMobile ? !mobileSidebarOpen : sidebarCollapsed}
        onToggleSidebar={() => isMobile ? setMobileSidebarOpen((c) => !c) : setSidebarCollapsed((c) => !c)}
        onSave={handleSave}
        onSaveAs={() => setFileDialog('save-as')}
        onBuild={handleBuild}
        onNewFromTemplate={() => setShowTemplateModal(true)}
        onOpenSettings={() => setShowSettings(true)}
        onTogglePreview={() => setShowPreview(!showPreview)}
        showPreview={showPreview}
      />

      <DocumentStatus onSaveAs={() => setFileDialog('save-as')} />

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden relative" inert={isNavigating || !!pendingDraft} aria-busy={isNavigating}>
        <SidebarPane
          width={sidebarWidth}
          collapsed={isMobile ? !mobileSidebarOpen : sidebarCollapsed}
          showHistory={showHistory}
          onShowHistory={() => useEditorStore.getState().setShowHistory(true)}
          onFileSelect={handleFileSelect}
          onExpand={() => isMobile ? setMobileSidebarOpen(true) : setSidebarCollapsed(false)}
        />

        {/* Sidebar resize handle */}
        {!sidebarCollapsed && !isMobile && (
          <div
            onMouseDown={handleSidebarMouseDown}
            className={cn(
              "w-1.5 cursor-col-resize transition-colors shrink-0 relative group",
              "bg-border/30 hover:bg-primary/30",
              isDragging && "bg-primary/40"
            )}
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-border/50 group-hover:bg-primary/40 transition-colors" />
          </div>
        )}

        {/* Editor + Preview horizontal split */}
        <div ref={splitContainerRef} className={cn('flex-1 min-w-0 flex overflow-hidden', isMobile && 'flex-col')}>
          {/* Code editor */}
          <div
            style={{ width: !isMobile && showPreview && !previewCollapsed ? `${splitRatio * 100}%` : "100%", height: isMobile && showPreview && !previewCollapsed ? '55%' : undefined }}
            className="flex flex-col min-h-0 overflow-hidden transition-all duration-200 p-3"
          >
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                <span className="text-sm">Loading workspace...</span>
              </div>
            ) : (
              <>
                {activeEditorTab === "text" && <EditorTabBar />}
                <div className={cn("flex-1 overflow-hidden", activeEditorTab === "text" && "mt-3")}>
                  {activeEditorTab === "text" ? <EditorPane /> : <VisualEditor />}
                </div>
              </>
            )}
          </div>

          {/* Horizontal divider (only when preview visible and expanded) */}
          {showPreview && !previewCollapsed && !isMobile && (
            <div
              onMouseDown={handleSplitMouseDown}
              className="w-1.5 cursor-col-resize transition-colors shrink-0 relative group bg-border/30 hover:bg-primary/30"
            >
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-border/50 group-hover:bg-primary/40 transition-colors" />
            </div>
          )}

          {/* PDF preview */}
          {showPreview && (
            <>
              {!previewCollapsed && (
                <div
                  style={{ width: isMobile ? '100%' : `${(1 - splitRatio) * 100}%`, height: isMobile ? '45%' : undefined }}
                  className="flex flex-col overflow-hidden p-3 pl-1.5"
                >
                  <PreviewPane
                    collapsed={previewCollapsed}
                    onToggleCollapse={() => setPreviewCollapsed((c) => !c)}
                  />
                </div>
              )}
              {previewCollapsed && (
                <div className="flex flex-col overflow-hidden py-3 pl-1.5">
                  <PreviewPane
                    collapsed={previewCollapsed}
                    onToggleCollapse={() => setPreviewCollapsed((c) => !c)}
                  />
                </div>
              )}
            </>
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
      {fileDialog && <FileDialogs key={fileDialog} mode={fileDialog} onClose={() => setFileDialog(null)} />}
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
        <Toaster richColors position="bottom-right" />
      </ColorPaletteProvider>
    </ThemeProvider>
  )
}
