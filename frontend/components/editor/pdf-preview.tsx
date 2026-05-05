"use client"

import { memo, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  ZoomIn,
  ZoomOut,
  Download,
  Maximize2,
  Moon,
  Sun,
} from "lucide-react"

interface PdfPreviewProps {
  fileName: string
  pdfUrl: string | null
  isBuilding: boolean
}

export const PdfPreview = memo(function PdfPreview({
  fileName,
  pdfUrl,
  isBuilding,
}: PdfPreviewProps) {
  const [zoom, setZoom] = useState(100)
  const [darkMode, setDarkMode] = useState(false)

  const handleToggleDark = useCallback(() => {
    setDarkMode((d) => !d)
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(25, z - 25))
  }, [])

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(200, z + 25))
  }, [])

  const handleFitPage = useCallback(() => {
    setZoom(100)
  }, [])

  const handleDownload = useCallback(() => {
    if (!pdfUrl) return
    const a = document.createElement("a")
    a.href = pdfUrl
    a.download = fileName
    a.click()
  }, [pdfUrl, fileName])

  return (
    <div className="h-full flex flex-col bg-muted/30 border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-border bg-muted/50">
        <span className="text-xs font-medium text-muted-foreground truncate max-w-[60%]">
          {pdfUrl ? fileName : "No preview available"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleZoomOut}
            disabled={isBuilding || !pdfUrl}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">
            {zoom}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleZoomIn}
            disabled={isBuilding || !pdfUrl}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleFitPage}
            disabled={isBuilding || !pdfUrl}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleDownload}
            disabled={isBuilding || !pdfUrl}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleToggleDark}
            disabled={isBuilding || !pdfUrl}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto scrollbar-thin p-2 flex justify-center bg-muted/20">
        {isBuilding ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin mb-4" />
            <p className="text-sm">Compiling document...</p>
          </div>
        ) : pdfUrl ? (
          <div
            className="bg-white shadow-lg rounded-sm overflow-hidden transition-transform origin-top-center"
            style={{
              transform: `scale(${zoom / 100})`,
              width: `${zoom >= 100 ? '100%' : `${zoom}%`}`,
              height: `${zoom >= 100 ? '100%' : `${zoom}%`}`,
              filter: darkMode ? "invert(1) hue-rotate(180deg)" : "none",
            }}
          >
            <iframe
              src={pdfUrl}
              title="PDF Preview"
              className="w-full h-full border-0"
              style={{ minWidth: "612px", minHeight: "792px" }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Maximize2 className="h-8 w-8 opacity-30" />
            <p className="text-xs">Build to generate PDF preview</p>
          </div>
        )}
      </div>
    </div>
  )
})
