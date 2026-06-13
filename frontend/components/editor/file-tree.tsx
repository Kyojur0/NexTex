"use client"

import { memo, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  Edit2,
  MoreVertical,
  Clock,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useEditorStore, FileItem } from "@/lib/store"

interface FileTreeItemProps {
  item: FileItem
  depth: number
  activeFileId: string | null
  onFileSelect: (id: string, path: string) => void
}

const FileTreeItemComponent = memo(function FileTreeItem({
  item,
  depth,
  activeFileId,
  onFileSelect,
}: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(item.name)

  const renameFile = useEditorStore((s) => s.renameFile)
  const deleteFile = useEditorStore((s) => s.deleteFile)
  const createFile = useEditorStore((s) => s.createFile)

  const isActive = activeFileId === item.id
  const isFolder = item.type === "folder"

  const handleRename = useCallback(() => {
    if (newName.trim() && newName !== item.name) {
      renameFile(item.id, newName.trim())
    }
    setIsRenaming(false)
    setNewName(item.name)
  }, [newName, item.id, item.name, renameFile])

  const handleDelete = useCallback(() => {
    deleteFile(item.id)
  }, [item.id, deleteFile])

  const handleCreateFile = useCallback(() => {
    createFile(item.id, "untitled.tex", "file")
  }, [item.id, createFile])

  const handleCreateFolder = useCallback(() => {
    createFile(item.id, "New Folder", "folder")
  }, [item.id, createFile])

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1.5 h-8 mx-1.5 px-2 cursor-pointer rounded-lg transition-all relative",
          isActive
            ? "bg-sidebar-primary/10 text-sidebar-primary shadow-elevated"
            : "hover:bg-sidebar-accent/60 text-sidebar-foreground/70 hover:text-sidebar-foreground"
        )}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
        onClick={() => {
          if (isFolder) {
            setIsExpanded(!isExpanded)
          } else {
            onFileSelect(item.id, item.path)
          }
        }}
      >
        {isFolder ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary/80" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-primary/80" />
            )}
          </>
        ) : (
          <>
            <div className="w-3.5" />
            <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </>
        )}

        {isRenaming ? (
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename()
              if (e.key === "Escape") {
                setIsRenaming(false)
                setNewName(item.name)
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent px-1 outline-none border-b border-primary/50 focus:border-primary text-xs"
          />
        ) : (
          <span className={cn("flex-1 truncate text-xs", isActive && "font-medium")}>{item.name}</span>
        )}

        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:bg-sidebar-accent">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-xl border-border/60 shadow-floating">
              <DropdownMenuItem onClick={() => setIsRenaming(true)}>
                <Edit2 className="mr-2 h-3 w-3" />
                Rename
              </DropdownMenuItem>
              {isFolder && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleCreateFile}>
                    <FileText className="mr-2 h-3 w-3" />
                    New File
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCreateFolder}>
                    <Folder className="mr-2 h-3 w-3" />
                    New Folder
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="mr-2 h-3 w-3" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isFolder && isExpanded && item.children && (
        <div className="relative">
          <div className="absolute left-[17px] top-0 bottom-0 w-px bg-border/30" />
          {item.children.map((child) => (
            <FileTreeItemComponent
              key={child.id}
              item={child}
              depth={depth + 1}
              activeFileId={activeFileId}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
})

interface FileTreeProps {
  files: FileItem[]
  activeFileId: string | null
  onFileSelect: (id: string, path: string) => void
  onShowHistory: () => void
}

export const FileTree = memo(function FileTree({
  files,
  activeFileId,
  onFileSelect,
  onShowHistory,
}: FileTreeProps) {
  const projectName = useEditorStore((s) => s.projectName)
  const createFile = useEditorStore((s) => s.createFile)

  const handleCreateRootFile = useCallback(() => {
    createFile(null, "untitled.tex", "file")
  }, [createFile])

  const handleCreateRootFolder = useCallback(() => {
    createFile(null, "New Folder", "folder")
  }, [createFile])

  return (
    <div className="flex flex-col h-full bg-sidebar/80 border-r border-sidebar-border/60 backdrop-blur-sm">
      <div className="h-10 border-b border-sidebar-border/60 px-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-sidebar-foreground/80 uppercase tracking-wider truncate">
          {projectName}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-md hover:bg-sidebar-accent">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 rounded-xl border-border/60 shadow-floating">
            <DropdownMenuItem onClick={handleCreateRootFile}>
              <FileText className="mr-2 h-3 w-3" />
              New File
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCreateRootFolder}>
              <Folder className="mr-2 h-3 w-3" />
              New Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin py-1.5">
        {files.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center leading-relaxed">
            No files yet.
            <br />
            Create a new file to get started.
          </div>
        ) : (
          files.map((item) => (
            <FileTreeItemComponent
              key={item.id}
              item={item}
              depth={0}
              activeFileId={activeFileId}
              onFileSelect={onFileSelect}
            />
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-sidebar-border/60 p-1.5">
        <button
          onClick={onShowHistory}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
        >
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Version History
        </button>
      </div>
    </div>
  )
})
