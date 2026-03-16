"use client"

import { useCallback, useEffect, useState } from "react"
import { ThemeProvider } from "next-themes"
import { Header } from "@/components/editor/header"
import { FileTree } from "@/components/editor/file-tree"
import { EnhancedCodeEditor } from "@/components/editor/enhanced-code-editor"
import { PdfPreview } from "@/components/editor/pdf-preview"
import { BuildLog } from "@/components/editor/build-log"
import { TemplateModal } from "@/components/editor/template-modal"
import { AdvancedSettings } from "@/components/editor/advanced-settings"
import { LayoutWrapper } from "@/components/editor/layout-wrapper"
import { ResizablePanels } from "@/components/editor/resizable-panels"
import { ColorPaletteProvider } from "@/lib/color-palette-context"
import { useEditorStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import {
  fetchFileTree,
  readFile,
  writeFile,
  compileLaTeX,
  getPdfUrl,
} from "@/lib/api"
import type { FileNode } from "@/lib/api"

// Helper: convert API FileNode[] to the store's FileItem[] shape
function apiNodesToFileItems(nodes: FileNode[]): any[] {
  return nodes.map((n) => ({
    id: n.id,
    name: n.name,
    type: n.type,
    path: n.path,
    children: n.children ? apiNodesToFileItems(n.children) : undefined,
  }))
}

// Helper: find a file item by id in a nested tree
function findFileById(items: any[], id: string): any | null {
  for (const item of items) {
    if (item.id === id) return item
    if (item.children) {
      const found = findFileById(item.children, id)
      if (found) return found
    }
  }
  return null
}

export default function EditorPage() {
  const {
    files,
    activeFileId,
    projectName,
    content,
    isModified,
    isBuilding,
    showBuildLog,
    showTemplateModal,
    showSettings,
    sidebarWidth,
    isDragging,
    settings,
    buildLogs,
    setActiveFile,
    setContent,
    setIsModified,
    setIsBuilding,
    setShowBuildLog,
    setShowTemplateModal,
    setShowSettings,
    setSidebarWidth,
    setIsDragging,
    setFiles,
    setBuildLogs,
  } = useEditorStore()

  const [mounted, setMounted] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  // Derive active item and path directly from the stored activeFileId
  const activeItem = activeFileId ? findFileById(files, activeFileId) : null
  const activeFileName = activeItem?.name || "Untitled"
  const activeFilePath = activeItem?.path || null

  // ------------------------------------------------------------------
  // Load file tree from backend on mount
  // ------------------------------------------------------------------
  const loadFileTree = useCallback(async () => {
    try {
      const tree = await fetchFileTree("")
      const items = apiNodesToFileItems(tree)
      setFiles(items)
    } catch (err) {
      console.error("Failed to load file tree:", err)
      // If backend is not reachable, set empty
      setFiles([])
    }
  }, [setFiles])

  useEffect(() => {
    setMounted(true)
    loadFileTree()
  }, [loadFileTree])

  // Handle sidebar resize
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true)
      e.preventDefault()
    },
    [setIsDragging]
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(150, Math.min(500, e.clientX))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, setSidebarWidth, setIsDragging])

  // ------------------------------------------------------------------
  // File selection — reads content from backend
  // ------------------------------------------------------------------
  const handleFileSelect = useCallback(
    async (fileId: string) => {
      const item = findFileById(files, fileId)
      if (!item || item.type === "folder" || !item.path) return

      try {
        const fileContent = await readFile(item.path)
        setActiveFile(fileId, fileContent)
      } catch (err) {
        console.error("Failed to read file:", err)
      }
    },
    [files, setActiveFile]
  )

  // Handle content change
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent)
      setIsModified(true)
    },
    [setContent, setIsModified]
  )

  // ------------------------------------------------------------------
  // Build – actually compile with the backend
  // ------------------------------------------------------------------
  const handleBuild = useCallback(async () => {
    if (!activeFilePath) {
      setBuildLogs([
        { type: "error" as const, message: "No file selected to compile", timestamp: new Date().toLocaleTimeString() },
      ])
      setShowBuildLog(true)
      return
    }

    setIsBuilding(true)
    setPdfUrl(null)

    const startLogs = [
      {
        type: "info" as const,
        message: `Starting ${settings.compiler} compilation...`,
        timestamp: new Date().toLocaleTimeString(),
      },
      {
        type: "info" as const,
        message: `Processing ${activeFilePath}`,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]
    setBuildLogs(startLogs)
    setShowBuildLog(true)

    try {
      // Save the file first
      await writeFile(activeFilePath, content)
      setIsModified(false)

      // Compile
      const result = await compileLaTeX(activeFilePath, settings.compiler)

      // Build log entries
      const newLogs = [
        ...startLogs,
        ...result.logs.map((l) => ({
          type: l.type as "info" | "warning" | "error" | "success",
          message: l.message,
          timestamp: new Date().toLocaleTimeString(),
        })),
      ]

      setBuildLogs(newLogs)

      if (result.success && result.pdf_available) {
        setPdfUrl(getPdfUrl(result.build_id))
      }
    } catch (err: any) {
      setBuildLogs([
        ...startLogs,
        {
          type: "error" as const,
          message: err.message || "Compilation failed",
          timestamp: new Date().toLocaleTimeString(),
        },
      ])
    } finally {
      setIsBuilding(false)
    }
  }, [activeFilePath, content, settings.compiler, setIsBuilding, setBuildLogs, setShowBuildLog, setIsModified])

  // ------------------------------------------------------------------
  // Save
  // ------------------------------------------------------------------
  const handleSave = useCallback(async () => {
    if (!activeFilePath || !isModified) return
    try {
      await writeFile(activeFilePath, content)
      setIsModified(false)
    } catch (err) {
      console.error("Failed to save:", err)
    }
  }, [activeFilePath, content, isModified, setIsModified])

  // Auto-save logic (fast: 1.5 second after stopping typing)
  useEffect(() => {
    if (!settings.autoSave || !isModified || !activeFilePath) return
    const timer = setTimeout(() => {
      handleSave()
    }, 1500)
    return () => clearTimeout(timer)
  }, [content, isModified, settings.autoSave, activeFilePath, handleSave])

  // Auto-compile logic (compiles right after a successful save)
  const [lastCompiledContent, setLastCompiledContent] = useState<string | null>(null)
  useEffect(() => {
    if (!settings.buildOnSave || isModified || !activeFilePath || isBuilding) return
    // Wait until it's effectively saved and unmodified
    if (lastCompiledContent === content) return // Already compiled this exact content
    
    setLastCompiledContent(content)
    handleBuild()
  }, [isModified, settings.buildOnSave, activeFilePath, content, handleBuild, isBuilding, lastCompiledContent])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        handleSave()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault()
        handleBuild()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSave, handleBuild])

  // Refresh file tree after file operations
  const handleRefreshTree = useCallback(() => {
    loadFileTree()
  }, [loadFileTree])

  if (!mounted) {
    return null
  }

  // activeItem and activeFileName are already derived above

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <ColorPaletteProvider>
        <LayoutWrapper>
          {/* Header */}
          <Header
            onOpenFolder={() => loadFileTree()}
            onOpenFile={() => console.log("Open file")}
            onSave={handleSave}
            onSaveAs={() => console.log("Save as")}
            onBuild={handleBuild}
            onNewFromTemplate={() => setShowTemplateModal(true)}
            onOpenSettings={() => setShowSettings(true)}
          />

          {/* Main Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar - File Explorer */}
            <div
              style={{ width: `${sidebarWidth}px` }}
              className={cn(
                "flex flex-col transition-all",
                isDragging && "select-none"
              )}
            >
              <FileTree
                files={files}
                activeFileId={activeFileId}
                onFileSelect={handleFileSelect}
                onRefresh={handleRefreshTree}
              />
            </div>

            {/* Resize Handle */}
            <div
              onMouseDown={handleMouseDown}
              className={cn(
                "w-1 bg-border hover:bg-muted-foreground/20 cursor-col-resize transition-colors",
                isDragging && "bg-muted-foreground/40"
              )}
            />

            {/* Editor and Preview Area + Build Log (Resizable Vertically) */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <ResizablePanels
                direction="vertical"
                initialRatio={0.7}
                minSize={100}
                className="flex-1"
              >
                {/* Top Section: Editor & PDF side by side */}
                <ResizablePanels
                  direction="horizontal"
                  initialRatio={0.5}
                  minSize={300}
                  className="flex-1 overflow-hidden"
                >
                  {/* Code Editor */}
                  <div className="flex flex-col min-w-0 p-4 h-full">
                    <EnhancedCodeEditor
                      content={content}
                      onChange={handleContentChange}
                      fileName={activeFileName}
                      fontSize={settings.fontSize}
                      tabSize={settings.tabSize}
                      enableSyntaxHighlight={settings.enableSyntaxHighlight}
                    />
                  </div>

                  {/* PDF Preview */}
                  <div className="flex flex-col min-w-0 p-4 h-full">
                    <PdfPreview
                      fileName={activeFileName}
                      isBuilding={isBuilding}
                      pdfUrl={pdfUrl}
                    />
                  </div>
                </ResizablePanels>

                {/* Bottom Section: Build Log Panel */}
                {showBuildLog ? (
                  <div className="bg-panel-bg flex flex-col h-full overflow-hidden">
                    <BuildLog
                      logs={buildLogs}
                      onClose={() => setShowBuildLog(false)}
                    />
                  </div>
                ) : null}
              </ResizablePanels>
            </div>
          </div>

          {/* Modals */}
          <TemplateModal
            open={showTemplateModal}
            onOpenChange={setShowTemplateModal}
          />
          <AdvancedSettings
            open={showSettings}
            onOpenChange={setShowSettings}
          />
        </LayoutWrapper>
      </ColorPaletteProvider>
    </ThemeProvider>
  )
}
