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
}

export const PdfPreview = memo(function PdfPreview({
  fileName,
  isBuilding,
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

  return (
    <div className="h-full flex flex-col bg-muted/30 border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-border bg-muted/50">
        <span className="text-xs font-medium text-muted-foreground">{fileName}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleZoomOut}
            disabled={isBuilding}
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
            disabled={isBuilding}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleFitPage}
            disabled={isBuilding}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={isBuilding}>
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto scrollbar-thin p-6 flex justify-center bg-muted/20">
        {isBuilding ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin mb-4" />
            <p className="text-sm">Compiling document...</p>
          </div>
        ) : (
          /* Simulated PDF preview - in real app this would render actual PDF */
          <div
            className="bg-card shadow-lg rounded-sm overflow-hidden transition-transform"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
            }}
          >
            <div className="w-[612px] h-[792px] p-12">
              {/* Simulated resume content */}
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-foreground">John Doe</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  john@email.com | (555) 123-4567 | San Francisco, CA | LinkedIn
                </p>
              </div>

              <div className="mb-6">
                <h2 className="text-sm font-bold uppercase tracking-wide border-b border-foreground/20 pb-1 mb-3">
                  Experience
                </h2>
                <div className="mb-4">
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold text-sm">Senior Software Engineer</span>
                    <span className="text-xs text-muted-foreground">2021 - Present</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm italic text-muted-foreground">Tech Company Inc.</span>
                    <span className="text-xs text-muted-foreground">San Francisco, CA</span>
                  </div>
                  <ul className="mt-2 text-sm space-y-1 ml-4">
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-foreground shrink-0" />
                      <span>Led development of microservices architecture</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-foreground shrink-0" />
                      <span>Improved system performance by 40%</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-foreground shrink-0" />
                      <span>Mentored team of 5 junior developers</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-sm font-bold uppercase tracking-wide border-b border-foreground/20 pb-1 mb-3">
                  Education
                </h2>
                <div>
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold text-sm">Bachelor of Science in Computer Science</span>
                    <span className="text-xs text-muted-foreground">2017</span>
                  </div>
                  <span className="text-sm italic text-muted-foreground">
                    University of California, Berkeley
                  </span>
                </div>
              </div>

              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide border-b border-foreground/20 pb-1 mb-3">
                  Skills
                </h2>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="font-semibold">Languages:</span> JavaScript, TypeScript, Python, Go
                  </p>
                  <p>
                    <span className="font-semibold">Frameworks:</span> React, Node.js, Next.js, FastAPI
                  </p>
                  <p>
                    <span className="font-semibold">Tools:</span> Git, Docker, Kubernetes, AWS
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
