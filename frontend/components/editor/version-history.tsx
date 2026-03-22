"use client"

import { memo, useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Clock,
  Star,
  X,
  RotateCcw,
  Check,
  Plus,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Version,
  saveVersion,
  getVersionsForFile,
  updateVersion,
  deleteVersion,
  pruneOldAutoVersions,
  formatRelativeTime,
} from "@/lib/version-db"
import { useEditorStore } from "@/lib/store"

interface VersionHistoryProps {
  onClose: () => void
}

export const VersionHistory = memo(function VersionHistory({ onClose }: VersionHistoryProps) {
  const { activeFileId, content, setContent, setIsModified } = useEditorStore()
  const [versions, setVersions] = useState<Version[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [previewVersion, setPreviewVersion] = useState<Version | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState("")
  const editInputRef = useRef<HTMLInputElement>(null)

  const loadVersions = useCallback(async () => {
    if (!activeFileId) return
    setIsLoading(true)
    try {
      const vs = await getVersionsForFile(activeFileId)
      setVersions(vs)
    } finally {
      setIsLoading(false)
    }
  }, [activeFileId])

  useEffect(() => {
    loadVersions()
  }, [loadVersions])

  // Auto-save a version every 2 minutes if content changes
  useEffect(() => {
    if (!activeFileId || !content) return
    const timer = setTimeout(async () => {
      await saveVersion({
        fileId: activeFileId,
        content,
        label: "Auto-saved",
        isStarred: false,
        isAuto: true,
        createdAt: Date.now(),
      })
      await pruneOldAutoVersions(activeFileId)
      loadVersions()
    }, 2 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [content, activeFileId, loadVersions])

  const handleSaveNow = useCallback(async () => {
    if (!activeFileId) return
    const label = `Manual save`
    await saveVersion({
      fileId: activeFileId,
      content,
      label,
      isStarred: false,
      isAuto: false,
      createdAt: Date.now(),
    })
    loadVersions()
  }, [activeFileId, content, loadVersions])

  const handleToggleStar = useCallback(async (version: Version, e: React.MouseEvent) => {
    e.stopPropagation()
    await updateVersion(version.id, { isStarred: !version.isStarred })
    loadVersions()
  }, [loadVersions])

  const handleDelete = useCallback(async (versionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteVersion(versionId)
    loadVersions()
  }, [loadVersions])

  const handleStartRename = useCallback((version: Version, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(version.id)
    setEditingLabel(version.label)
    setTimeout(() => editInputRef.current?.select(), 50)
  }, [])

  const handleSaveRename = useCallback(async () => {
    if (!editingId) return
    await updateVersion(editingId, { label: editingLabel || "Unnamed version" })
    setEditingId(null)
    loadVersions()
  }, [editingId, editingLabel, loadVersions])

  const handleRestore = useCallback(() => {
    if (!previewVersion) return
    setContent(previewVersion.content)
    setIsModified(true)
    setPreviewVersion(null)
  }, [previewVersion, setContent, setIsModified])

  const handlePreview = useCallback((version: Version) => {
    setPreviewVersion(prev => prev?.id === version.id ? null : version)
  }, [])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold">Version History</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1"
            onClick={handleSaveNow}
            title="Save snapshot now"
          >
            <Plus className="h-3 w-3" />
            Save now
          </Button>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Preview restore bar */}
      {previewVersion && (
        <div className="px-3 py-2 bg-primary/10 border-b border-primary/20 shrink-0 flex items-center justify-between">
          <span className="text-xs text-primary font-medium">Viewing: {previewVersion.label}</span>
          <Button
            size="sm"
            className="h-6 px-2.5 text-xs gap-1"
            onClick={handleRestore}
          >
            <RotateCcw className="h-3 w-3" />
            Restore
          </Button>
        </div>
      )}

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <div className="p-4 text-xs text-muted-foreground text-center">Loading history...</div>
        ) : versions.length === 0 ? (
          <div className="p-5 flex flex-col items-center gap-3 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/40" />
            <div>
              <p className="text-xs font-medium text-muted-foreground">No history yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Versions auto-save every 2 minutes, or save manually.</p>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleSaveNow}>
              <Plus className="h-3 w-3" /> Save first snapshot
            </Button>
          </div>
        ) : (
          <div className="py-2 relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[22px] top-4 bottom-4 w-px bg-border" aria-hidden />

            {versions.map((version, index) => {
              const isActive = previewVersion?.id === version.id
              const isEditing = editingId === version.id

              return (
                <div
                  key={version.id}
                  className={cn(
                    "flex gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors group relative",
                    isActive && "bg-primary/5"
                  )}
                  onClick={() => handlePreview(version)}
                >
                  {/* Timeline node */}
                  <div className="shrink-0 w-5 h-5 mt-0.5 flex items-center justify-center z-10">
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full border-2 transition-all",
                        version.isStarred
                          ? "bg-primary border-primary"
                          : index === 0
                          ? "bg-foreground border-foreground"
                          : "bg-background border-border group-hover:border-muted-foreground"
                      )}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        ref={editInputRef}
                        value={editingLabel}
                        onChange={e => setEditingLabel(e.target.value)}
                        onBlur={handleSaveRename}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleSaveRename()
                          if (e.key === "Escape") setEditingId(null)
                        }}
                        onClick={e => e.stopPropagation()}
                        className="text-xs w-full bg-background border border-primary/40 rounded px-1.5 py-0.5 outline-none"
                      />
                    ) : (
                      <p
                        className="text-xs font-medium leading-tight truncate"
                        onDoubleClick={(e) => handleStartRename(version, e)}
                        title="Double-click to rename"
                      >
                        {version.label}
                        {index === 0 && <span className="ml-1.5 text-[10px] text-primary">current</span>}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {formatRelativeTime(version.createdAt)}
                      {version.isAuto ? " · auto" : " · manual"}
                    </p>
                  </div>

                  {/* Actions (hover) */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => handleToggleStar(version, e)}
                      className={cn(
                        "w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors",
                        version.isStarred ? "text-primary" : "text-muted-foreground"
                      )}
                      title={version.isStarred ? "Unstar" : "Star version"}
                    >
                      <Star className={cn("h-3 w-3", version.isStarred && "fill-current")} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(version.id, e)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete version"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
})
