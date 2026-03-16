"use client"

import { memo, useRef, useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"

interface ResizablePanelsProps {
  children: [React.ReactNode, React.ReactNode | false | null | undefined]
  initialRatio?: number // 0-1, where 0.5 = 50/50 split
  direction?: "horizontal" | "vertical"
  minSize?: number
  className?: string
}

export const ResizablePanels = memo(function ResizablePanels({
  children,
  initialRatio = 0.5,
  direction = "vertical",
  minSize = 200,
  className,
}: ResizablePanelsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [ratio, setRatio] = useState(initialRatio)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging || !containerRef.current) return

    const container = containerRef.current
    const isVertical = direction === "vertical"
    const containerSize = isVertical ? container.clientHeight : container.clientWidth

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const pos = isVertical ? e.clientY - rect.top : e.clientX - rect.left

      const newRatio = Math.max(
        minSize / containerSize,
        Math.min((containerSize - minSize) / containerSize, pos / containerSize)
      )

      setRatio(newRatio)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, direction, minSize])

  const isVertical = direction === "vertical"
  const hasSecondPanel = !!children[1]

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full w-full",
        isVertical ? "flex-col" : "flex-row",
        className
      )}
    >
      {/* First Panel */}
      <div
        style={
          !hasSecondPanel
            ? { flex: 1 }
            : isVertical
            ? { height: `${ratio * 100}%` }
            : { width: `${ratio * 100}%` }
        }
        className="overflow-hidden flex flex-col min-h-0 min-w-0"
      >
        {children[0]}
      </div>

      {/* Divider */}
      {hasSecondPanel && (
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            "bg-border hover:bg-muted-foreground/30 transition-colors shrink-0",
            isVertical
              ? "h-1 w-full cursor-row-resize"
              : "w-1 h-full cursor-col-resize",
            isDragging && "bg-muted-foreground/50"
          )}
        />
      )}

      {/* Second Panel */}
      {hasSecondPanel && (
        <div
          style={
            isVertical
              ? { height: `${(1 - ratio) * 100}%` }
              : { width: `${(1 - ratio) * 100}%` }
          }
          className="overflow-hidden flex flex-col min-h-0 min-w-0"
        >
          {children[1]}
        </div>
      )}
    </div>
  )
})
