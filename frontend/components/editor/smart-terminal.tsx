"use client"

import { memo, useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronUp,
  ChevronDown,
  Terminal,
  Loader,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface LogEntry {
  type: "info" | "warning" | "error" | "success"
  message: string
  line?: number
  timestamp: string
}

interface SmartTerminalProps {
  logs: LogEntry[]
  isBuilding: boolean
  isOpen: boolean
  onToggle: () => void
  onJumpToLine: (line: number) => void
}

type ActiveTab = "logs" | "issues"

// Parse a log message for a line reference (e.g. "line 12" or "l.12")
function parseLineRef(message: string): number | null {
  const patterns = [
    /\bline\s+(\d+)/i,
    /\bl\.(\d+)\b/,
    /\:(\d+)\:/,
    /error\s+on\s+line\s+(\d+)/i,
  ]
  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match) return parseInt(match[1])
  }
  return null
}

const LogRow = memo(function LogRow({
  log,
  onJumpToLine,
}: {
  log: LogEntry
  onJumpToLine: (line: number) => void
}) {
  const lineRef = parseLineRef(log.message)

  const rowClasses = cn(
    "flex gap-3 px-4 py-2 border-b border-border/20 font-mono text-xs leading-relaxed hover:bg-muted/20 transition-colors",
    log.type === "error" && "bg-red-500/[0.03]",
    log.type === "warning" && "bg-yellow-500/[0.03]",
    log.type === "success" && "bg-green-500/[0.03]",
  )

  const textClasses = cn(
    "flex-1 break-words",
    log.type === "error" && "text-red-600 dark:text-red-400",
    log.type === "warning" && "text-yellow-600 dark:text-yellow-400",
    log.type === "success" && "text-green-600 dark:text-green-400",
    log.type === "info" && "text-muted-foreground",
  )

  const renderMessage = () => {
    if (!lineRef) return <span>{log.message}</span>
    const pattern = /(\bline\s+\d+|\bl\.\d+\b|\:\d+\:)/i
    const parts = log.message.split(pattern)
    return (
      <span>
        {parts.map((part, i) => {
          if (pattern.test(part)) {
            return (
              <button
                key={i}
                onClick={() => onJumpToLine(lineRef)}
                className="underline underline-offset-2 hover:opacity-70 transition-opacity cursor-pointer"
              >
                {part}
              </button>
            )
          }
          return <span key={i}>{part}</span>
        })}
      </span>
    )
  }

  return (
    <div className={rowClasses}>
      <span className="mt-0.5 shrink-0">
        {log.type === "error" && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
        {log.type === "warning" && <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />}
        {log.type === "success" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
        {log.type === "info" && <Info className="h-3.5 w-3.5 text-muted-foreground/60" />}
      </span>
      <span className={textClasses}>{renderMessage()}</span>
      <span className="text-muted-foreground/40 shrink-0 text-[10px] mt-0.5 tabular-nums">{log.timestamp}</span>
    </div>
  )
})

export const SmartTerminal = memo(function SmartTerminal({
  logs,
  isBuilding,
  isOpen,
  onToggle,
  onJumpToLine,
}: SmartTerminalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("logs")
  const [panelHeight, setPanelHeight] = useState(200)
  const [isResizing, setIsResizing] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  const errorCount = logs.filter(l => l.type === "error").length
  const warningCount = logs.filter(l => l.type === "warning").length
  const issueLogs = logs.filter(l => l.type === "error" || l.type === "warning")
  const hasSuccess = logs.some(l => l.type === "success")

  useEffect(() => {
    if (isOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [logs, isOpen])

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startYRef.current = e.clientY
    startHeightRef.current = panelHeight
    setIsResizing(true)
  }, [panelHeight])

  useEffect(() => {
    if (!isResizing) return
    const handleMouseMove = (e: MouseEvent) => {
      const delta = startYRef.current - e.clientY
      const newHeight = Math.max(100, Math.min(500, startHeightRef.current + delta))
      setPanelHeight(newHeight)
    }
    const handleMouseUp = () => setIsResizing(false)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isResizing])

  const displayedLogs = activeTab === "issues" ? issueLogs : logs

  return (
    <div
      ref={panelRef}
      className={cn(
        "border-t border-border/60 bg-card/50 backdrop-blur-sm flex flex-col shrink-0 transition-all shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]",
        isResizing && "select-none"
      )}
      style={{ height: isOpen ? `${panelHeight}px` : "auto" }}
    >
      {isOpen && (
        <div
          onMouseDown={handleResizeMouseDown}
          className={cn(
            "h-1.5 w-full cursor-row-resize hover:bg-primary/30 transition-colors shrink-0 flex items-center justify-center",
            isResizing && "bg-primary/40"
          )}
        >
          <div className="w-8 h-1 rounded-full bg-border/60" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 shrink-0 border-b border-border/40 bg-muted/30 h-9">
        <div className="flex items-center gap-1">
          <TabButton
            isActive={activeTab === "logs" && isOpen}
            onClick={() => { setActiveTab("logs"); if (!isOpen) onToggle() }}
            icon={<Terminal className="h-3.5 w-3.5" />}
            label="Logs"
            badge={isBuilding ? <Loader className="h-3 w-3 animate-spin" /> : undefined}
          />
          <TabButton
            isActive={activeTab === "issues" && isOpen}
            onClick={() => { setActiveTab("issues"); if (!isOpen) onToggle() }}
            icon={<AlertCircle className="h-3.5 w-3.5" />}
            label="Issues"
            badge={(errorCount > 0 || warningCount > 0) ? (
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none",
                errorCount > 0 ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
              )}>
                {errorCount > 0 ? errorCount : warningCount}
              </span>
            ) : undefined}
          />
        </div>

        <div className="flex items-center gap-3">
          {!isBuilding && logs.length > 0 && (
            <div className="flex items-center gap-3 text-[11px]">
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-red-500">
                  <AlertCircle className="h-3 w-3" />{errorCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="flex items-center gap-1 text-yellow-500">
                  <AlertTriangle className="h-3 w-3" />{warningCount}
                </span>
              )}
              {hasSuccess && errorCount === 0 && (
                <span className="flex items-center gap-1 text-green-500">
                  <CheckCircle2 className="h-3 w-3" /> Built
                </span>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 rounded-lg hover:bg-muted"
            onClick={onToggle}
            aria-label={isOpen ? "Collapse terminal" : "Expand terminal"}
          >
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="flex-1 overflow-y-auto scrollbar-thin bg-background/50">
          {displayedLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-6">
              {activeTab === "issues" ? (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-500/70" />
                  </div>
                  <p className="text-xs text-muted-foreground">No issues found</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <Terminal className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-xs text-muted-foreground">Run a build to see output here</p>
                </>
              )}
            </div>
          ) : (
            <>
              {displayedLogs.map((log, i) => (
                <LogRow key={i} log={log} onJumpToLine={onJumpToLine} />
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </div>
      )}
    </div>
  )
})

function TabButton({
  isActive,
  onClick,
  icon,
  label,
  badge,
}: {
  isActive: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors",
        isActive
          ? "bg-background text-foreground shadow-elevated"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
      )}
    >
      {icon}
      {label}
      {badge && <span className="ml-0.5">{badge}</span>}
    </button>
  )
}
