"use client"

import { memo, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { X, AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react"

interface LogEntry {
  type: "info" | "warning" | "error" | "success"
  message: string
  line?: number
  timestamp: string
}

interface BuildLogProps {
  logs: LogEntry[]
  onClose: () => void
}

const getLogIcon = (type: string) => {
  switch (type) {
    case "error":
      return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
    case "success":
      return <CheckCircle className="h-4 w-4 text-success shrink-0" />
    default:
      return <Info className="h-4 w-4 text-muted-foreground shrink-0" />
  }
}

const LogEntryComponent = memo(function LogEntry({ log }: { log: LogEntry }) {
  return (
    <div className="flex gap-3 text-xs p-2 border-b border-border hover:bg-muted/50 transition-colors">
      {getLogIcon(log.type)}
      <div className="flex-1 min-w-0">
        <p className="text-muted-foreground">{log.message}</p>
        <div className="flex gap-2 mt-1">
          {log.line && <span className="text-muted-foreground/60">Line {log.line}</span>}
          <span className="text-muted-foreground/60 ml-auto shrink-0">{log.timestamp}</span>
        </div>
      </div>
    </div>
  )
})

export const BuildLog = memo(function BuildLog({
  logs,
  onClose,
}: BuildLogProps) {
  const errorCount = logs.filter((l) => l.type === "error").length
  const warningCount = logs.filter((l) => l.type === "warning").length
  const hasErrors = errorCount > 0

  return (
    <div className="flex flex-col h-full bg-panel-bg">
      {/* Header */}
      <div className="h-9 border-b border-panel-border bg-muted/30 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Build Log</span>
          {hasErrors && (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          )}
          {!hasErrors && warningCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-warning">
              <AlertTriangle className="h-3 w-3" />
              {warningCount} warning{warningCount !== 1 ? "s" : ""}
            </span>
          )}
          {!hasErrors && warningCount === 0 && logs.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-success">
              <CheckCircle className="h-3 w-3" />
              Success
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {logs.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">
            No build logs yet. Click Build to compile.
          </div>
        ) : (
          logs.map((log, i) => <LogEntryComponent key={i} log={log} />)
        )}
      </div>
    </div>
  )
})
