"use client"

import { memo, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  ZoomIn,
  ZoomOut,
  Download,
  Maximize2,
  Moon,
  Sun,
  PanelRight,
  PanelRightClose,
} from "lucide-react"

interface PdfPreviewProps {
  fileName: string
  pdfUrl: string | null
  isBuilding: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export const PdfPreview = memo(function PdfPreview({
  fileName,
  pdfUrl,
  isBuilding,
  collapsed,
  onToggleCollapse,
}: PdfPreviewProps) {
  const [zoom, setZoom] = useState(100)
  const [fitPage, setFitPage] = useState(true)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [darkMode, setDarkMode] = useState(false)

  const handleToggleDark = useCallback(() => {
    setDarkMode((d) => !d)
  }, [])

  const handleZoomOut = useCallback(() => {
    setFitPage(false)
    setZoom((z) => Math.max(25, z - 25))
  }, [])

  const handleZoomIn = useCallback(() => {
    setFitPage(false)
    setZoom((z) => Math.min(200, z + 25))
  }, [])

  const handleFitPage = useCallback(() => {
    setFitPage(true)
    setZoom(100)
  }, [])

  const handleDownload = useCallback(async () => {
    if (!pdfUrl) return
    setDownloadError(null)
    try {
      const response = await fetch(pdfUrl)
      if (!response.ok) throw new Error('The PDF could not be downloaded. Build again and retry.')
      const url = URL.createObjectURL(await response.blob())
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'PDF download failed.')
    }
  }, [pdfUrl, fileName])

  if (collapsed) {
    return (
      <div className="h-full w-10 flex flex-col items-center py-2 border-l border-border/60 bg-card/30 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-lg"
          onClick={onToggleCollapse}
          aria-label="Expand preview"
          title="Expand preview"
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-card border border-border/60 rounded-xl overflow-hidden shadow-elevated">
      {/* Toolbar */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-border/40 bg-muted/40">
        <span className="text-xs font-medium text-muted-foreground truncate max-w-[60%] flex items-center gap-2">
          <span className={cn("w-1.5 h-1.5 rounded-full", pdfUrl ? "bg-success" : "bg-muted-foreground/40")} />
          {pdfUrl ? fileName : "No preview available"}
        </span>
        <div className="flex items-center gap-0.5">
          <ToolbarButton title="Zoom out" onClick={handleZoomOut} disabled={isBuilding || !pdfUrl}>
            <ZoomOut className="h-3.5 w-3.5" />
          </ToolbarButton>
          <span className="text-[11px] text-muted-foreground w-10 text-center tabular-nums">
            {fitPage ? 'Fit' : `${zoom}%`}
          </span>
          <ToolbarButton title="Zoom in" onClick={handleZoomIn} disabled={isBuilding || !pdfUrl}>
            <ZoomIn className="h-3.5 w-3.5" />
          </ToolbarButton>
          <div className="w-px h-4 bg-border/60 mx-1" />
          <ToolbarButton title="Fit page" onClick={handleFitPage} disabled={isBuilding || !pdfUrl}>
            <Maximize2 className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton title="Download PDF" onClick={handleDownload} disabled={isBuilding || !pdfUrl}>
            <Download className="h-3.5 w-3.5" />
          </ToolbarButton>
          <div className="w-px h-4 bg-border/60 mx-1" />
          <ToolbarButton
            onClick={handleToggleDark}
            disabled={isBuilding || !pdfUrl}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </ToolbarButton>
          <div className="w-px h-4 bg-border/60 mx-1" />
          <ToolbarButton
            onClick={onToggleCollapse}
            title="Collapse preview"
          >
            <PanelRightClose className="h-3.5 w-3.5" />
          </ToolbarButton>
        </div>
      </div>

      {downloadError && <p role="alert" className="px-3 py-2 text-xs text-destructive">{downloadError}</p>}

      {/* Preview area */}
      <div className="flex-1 overflow-auto scrollbar-thin p-3 flex justify-center bg-muted/20">
        {isBuilding ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-4" />
            <p className="text-sm">Compiling document...</p>
          </div>
        ) : pdfUrl ? (
          <div
            className="bg-white shadow-floating rounded-sm overflow-hidden w-full h-full min-h-0"
            style={{
              filter: darkMode ? "invert(1) hue-rotate(180deg)" : "none",
            }}
          >
            <iframe
              src={`${pdfUrl.split('#')[0]}#toolbar=0&navpanes=0&${fitPage ? 'view=Fit' : `zoom=${zoom}`}`}
              title="PDF Preview"
              className="w-full h-full border-0"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground gap-3">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Maximize2 className="h-6 w-6 opacity-40" />
            </div>
            <p className="text-xs">Build to generate PDF preview</p>
          </div>
        )}
      </div>
    </div>
  )
})

function ToolbarButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 rounded-lg hover:bg-muted disabled:opacity-40"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
    >
      {children}
    </Button>
  )
}
