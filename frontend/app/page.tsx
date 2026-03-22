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

const SAMPLE_RESUME = `\\documentclass{article}
\\usepackage[margin=0.5in]{geometry}
\\usepackage{hyperref}
\\usepackage{enumitem}

\\begin{document}

\\begin{center}
  {\\LARGE \\textbf{John Doe}} \\\\[4pt]
  john@example.com $\\cdot$ (555) 123-4567 $\\cdot$ linkedin.com/in/johndoe
\\end{center}

\\section*{PROFESSIONAL SUMMARY}
Experienced software engineer with 5+ years of expertise in full-stack development, cloud architecture, and team leadership. Passionate about building scalable systems and mentoring engineers.

\\section*{EXPERIENCE}

\\textbf{Senior Software Engineer} \\hfill Jan 2021 -- Present \\\\
\\textit{Tech Company Inc., San Francisco, CA}
\\begin{itemize}[leftmargin=*,nosep]
  \\item Led development of microservices architecture handling 10M+ requests/day
  \\item Mentored 3 junior developers and conducted 50+ technical interviews
  \\item Reduced system latency by 40\\% through caching and query optimization
\\end{itemize}

\\textbf{Software Engineer} \\hfill Jun 2018 -- Dec 2020 \\\\
\\textit{Startup Co., New York, NY}
\\begin{itemize}[leftmargin=*,nosep]
  \\item Built React dashboard used by 10,000+ daily active users
  \\item Designed and implemented REST API with Node.js and PostgreSQL
\\end{itemize}

\\section*{EDUCATION}

\\textbf{Bachelor of Science in Computer Science} \\hfill May 2018 \\\\
\\textit{State University}

\\section*{SKILLS}

\\textbf{Languages:} Python, JavaScript, TypeScript, Go, SQL \\\\
\\textbf{Frameworks:} React, Node.js, FastAPI, Next.js \\\\
\\textbf{Tools:} Docker, AWS, PostgreSQL, Redis, Git

\\end{document}`

function EditorInner() {
  const {
    files,
    activeFileId,
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
    setActiveFile,
    setContent,
    setIsModified,
    setIsBuilding,
    setShowBuildLog,
    setShowTemplateModal,
    setShowSettings,
    setShowPreview,
    setShowHistory,
    setShowAISpotlight,
    setSidebarWidth,
    setIsDragging,
    setFiles,
    setBuildLogs,
  } = useEditorStore()

  const [mounted, setMounted] = useState(false)
  // Horizontal split ratio between editor and preview (0.55 default = editor takes 55%)
  const [splitRatio, setSplitRatio] = useState(0.55)
  const splitDragging = useRef(false)
  const splitContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    if (files.length === 0) {
      setFiles([
        {
          id: "folder-1",
          name: "my-resume",
          type: "folder",
          children: [
            { id: "file-1", name: "resume.tex", type: "file", isMain: true, content: SAMPLE_RESUME },
            { id: "file-2", name: "sections.tex", type: "file", content: "% Additional sections\n" },
            { id: "file-3", name: "style.sty", type: "file", content: "% Custom style definitions\n" },
          ],
        },
      ])
      setActiveFile("file-1", SAMPLE_RESUME)
    }
  }, [files.length, setFiles, setActiveFile])

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

  const handleFileSelect = useCallback((fileId: string) => {
    const findFileContent = (items: typeof files): string | null => {
      for (const item of items) {
        if (item.id === fileId) return item.content || ""
        if (item.children) {
          const found = findFileContent(item.children)
          if (found !== null) return found
        }
      }
      return null
    }
    const fileContent = findFileContent(files)
    if (fileContent !== null) setActiveFile(fileId, fileContent)
  }, [files, setActiveFile])

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    setIsModified(true)
  }, [setContent, setIsModified])

  const handleBuild = useCallback(() => {
    setIsBuilding(true)
    setShowBuildLog(true)
    const ts = new Date().toLocaleTimeString()
    const fileName = activeFileId ? (files.flatMap(f => f.children || []).find(f => f.id === activeFileId)?.name || "document") : "document"
    setBuildLogs([
      { type: "info", message: `Starting ${settings.compiler} compilation...`, timestamp: ts },
      { type: "info", message: `Processing ${fileName}`, timestamp: ts },
      { type: "info", message: "Running pass 1/2...", timestamp: ts },
      { type: "info", message: "Running pass 2/2...", timestamp: ts },
    ])
    setTimeout(() => {
      const ts2 = new Date().toLocaleTimeString()
      setBuildLogs([
        { type: "info", message: `Starting ${settings.compiler} compilation...`, timestamp: ts },
        { type: "info", message: `Processing ${fileName}`, timestamp: ts },
        { type: "success", message: "Compiled successfully in 1.4s (1 page, 138KB)", timestamp: ts2 },
      ])
      setIsBuilding(false)
    }, 1800)
  }, [setIsBuilding, setShowBuildLog, setBuildLogs, activeFileId, files, settings.compiler])

  const handleSave = useCallback(() => {
    setIsModified(false)
  }, [setIsModified])

  const handleJumpToLine = useCallback((line: number) => {
    // Broadcast to the editor to jump to that line
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

  const activeFileName = (() => {
    const flat = (items: typeof files): typeof files => items.flatMap(i => i.type === "folder" ? flat(i.children || []) : [i])
    return flat(files).find(f => f.id === activeFileId)?.name || "Untitled"
  })()

  return (
    <LayoutWrapper>
      <Header
        onOpenFolder={() => {}}
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
    </LayoutWrapper>
  )
}

export default function EditorPage() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem suppressHydrationWarning>
      <ColorPaletteProvider>
        <EditorInner />
      </ColorPaletteProvider>
    </ThemeProvider>
  )
}
