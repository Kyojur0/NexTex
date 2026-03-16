"use client"

import { memo, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  ZoomIn,
  ZoomOut,
  Download,
  Maximize2,
} from "lucide-react"

interface PdfPreviewProps {
  fileName: string
  isBuilding: boolean
  pdfUrl?: string | null
}

export const PdfPreview = memo(function PdfPreview({
  fileName,
  isBuilding,
  pdfUrl,
}: PdfPreviewProps) {
  const [zoom, setZoom] = useState(100)

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
    if (pdfUrl) {
      const a = document.createElement("a")
      a.href = pdfUrl
      a.download = fileName.replace(/\.tex$/, ".pdf")
      a.click()
    }
  }, [pdfUrl, fileName])

  return (
    <div className="h-full flex flex-col bg-muted/30 border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-border bg-muted/50">
        <span className="text-xs font-medium text-muted-foreground">
          {pdfUrl ? fileName.replace(/\.tex$/, ".pdf") : "Preview"}
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
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto scrollbar-thin flex justify-center bg-muted/20">
        {isBuilding ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin mb-4" />
            <p className="text-sm">Compiling document...</p>
          </div>
        ) : pdfUrl ? (
          /* Actual PDF viewer via iframe */
          <div
            className="w-full h-full"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
            }}
          >
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0`}
              className="w-full h-full border-0"
              title="PDF Preview"
            />
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center text-muted-foreground h-full gap-2">
            <div className="w-16 h-20 border-2 border-dashed border-muted-foreground/30 rounded-md flex items-center justify-center">
              <span className="text-xs text-muted-foreground/50">PDF</span>
            </div>
            <p className="text-sm">No preview available</p>
            <p className="text-xs text-muted-foreground/60">
              Click <strong>Build</strong> or press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">⌘B</kbd> to compile
            </p>
          </div>
        )}
      </div>
    </div>
  )
})
