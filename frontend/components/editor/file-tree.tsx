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
  RefreshCw,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useEditorStore, FileItem } from "@/lib/store"
import {
  createItem as apiCreateItem,
  renameItem as apiRenameItem,
  deleteItem as apiDeleteItem,
} from "@/lib/api"

interface FileTreeItemProps {
  item: FileItem & { path?: string }
  depth: number
  activeFileId: string | null
  onFileSelect: (id: string) => void
  onRefresh?: () => void
}

const FileTreeItemComponent = memo(function FileTreeItem({
  item,
  depth,
  activeFileId,
  onFileSelect,
  onRefresh,
}: FileTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(item.name)

  const { renameFile, deleteFile, createFile } = useEditorStore()

  const isActive = activeFileId === item.id
  const isFolder = item.type === "folder"

  const handleRename = useCallback(async () => {
    if (newName.trim() && newName !== item.name && (item as any).path) {
      const pathParts = (item as any).path.split("/")
      pathParts[pathParts.length - 1] = newName.trim()
      const newPath = pathParts.join("/")
      try {
        await apiRenameItem((item as any).path, newPath)
        renameFile(item.id, newName.trim())
        onRefresh?.()
      } catch (err) {
        console.error("Failed to rename:", err)
      }
    }
    setIsRenaming(false)
    setNewName(item.name)
  }, [newName, item, renameFile, onRefresh])

  const handleDelete = useCallback(async () => {
    if (!(item as any).path) return
    try {
      await apiDeleteItem((item as any).path)
      deleteFile(item.id)
      onRefresh?.()
    } catch (err) {
      console.error("Failed to delete:", err)
    }
  }, [item, deleteFile, onRefresh])

  const handleCreateFile = useCallback(async () => {
    if (!(item as any).path) return
    const newFilePath = `${(item as any).path}/untitled.tex`
    try {
      await apiCreateItem(newFilePath, "file")
      createFile(item.id, "untitled.tex", "file")
      onRefresh?.()
    } catch (err) {
      console.error("Failed to create file:", err)
    }
  }, [item, createFile, onRefresh])

  const handleCreateFolder = useCallback(async () => {
    if (!(item as any).path) return
    const newFolderPath = `${(item as any).path}/New Folder`
    try {
      await apiCreateItem(newFolderPath, "folder")
      createFile(item.id, "New Folder", "folder")
      onRefresh?.()
    } catch (err) {
      console.error("Failed to create folder:", err)
    }
  }, [item, createFile, onRefresh])

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 h-7 px-2 cursor-pointer rounded-sm transition-colors relative",
          isActive
            ? "bg-accent text-accent-foreground"
            : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          if (isFolder) {
            setIsExpanded(!isExpanded)
          } else {
            onFileSelect(item.id)
          }
        }}
      >
        {isFolder ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0" />
            )}
          </>
        ) : (
          <>
            <div className="w-3.5" />
            <FileText className="h-3.5 w-3.5 shrink-0" />
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
            className="flex-1 bg-transparent px-1 outline-none border-b border-accent focus:border-foreground"
          />
        ) : (
          <span className="flex-1 truncate text-xs">{item.name}</span>
        )}

        {/* Context Menu */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
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

      {/* Children */}
      {isFolder && isExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <FileTreeItemComponent
              key={child.id}
              item={child}
              depth={depth + 1}
              activeFileId={activeFileId}
              onFileSelect={onFileSelect}
              onRefresh={onRefresh}
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
  onFileSelect: (id: string) => void
  onRefresh?: () => void
}

export const FileTree = memo(function FileTree({
  files,
  activeFileId,
  onFileSelect,
  onRefresh,
}: FileTreeProps) {
  const { projectName, createFile } = useEditorStore()

  const handleCreateRootFile = useCallback(async () => {
    try {
      await apiCreateItem("untitled.tex", "file")
      createFile(null, "untitled.tex", "file")
      onRefresh?.()
    } catch (err) {
      console.error("Failed to create root file:", err)
    }
  }, [createFile, onRefresh])

  const handleCreateRootFolder = useCallback(async () => {
    try {
      await apiCreateItem("New Folder", "folder")
      createFile(null, "New Folder", "folder")
      onRefresh?.()
    } catch (err) {
      console.error("Failed to create root folder:", err)
    }
  }, [createFile, onRefresh])

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="h-9 border-b border-sidebar-border px-4 flex items-center justify-between">
        <span className="text-xs font-semibold text-sidebar-foreground truncate">
          ~/stuff
        </span>
        <div className="flex items-center gap-0.5">
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={onRefresh}
              title="Refresh file tree"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                <Plus className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
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
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {files.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">
            No files in ~/stuff. Create a new file or folder to get started.
          </div>
        ) : (
          files.map((item) => (
            <FileTreeItemComponent
              key={item.id}
              item={item}
              depth={0}
              activeFileId={activeFileId}
              onFileSelect={onFileSelect}
              onRefresh={onRefresh}
            />
          ))
        )}
      </div>
    </div>
  )
})
