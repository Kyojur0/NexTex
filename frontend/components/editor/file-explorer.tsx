"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  MoreHorizontal,
  Star,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface FileItem {
  id: string
  name: string
  type: "file" | "folder"
  children?: FileItem[]
  isMain?: boolean
}

interface FileExplorerProps {
  files: FileItem[]
  activeFileId: string | null
  onFileSelect: (id: string) => void
  onNewFile: () => void
}

function FileTreeItem({
  item,
  depth,
  activeFileId,
  onFileSelect,
}: {
  item: FileItem
  depth: number
  activeFileId: string | null
  onFileSelect: (id: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const isActive = activeFileId === item.id
  const isFolder = item.type === "folder"

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 h-7 px-2 cursor-pointer rounded-sm transition-colors",
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
            <span className="w-3.5" />
            <FileText className="h-3.5 w-3.5 shrink-0" />
          </>
        )}
        <span className="text-xs truncate flex-1">{item.name}</span>
        {item.isMain && (
          <Star className="h-3 w-3 fill-current opacity-50" />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-0 group-hover:opacity-100 h-5 w-5 flex items-center justify-center rounded hover:bg-background/50"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {!isFolder && (
              <DropdownMenuItem>Set as Main File</DropdownMenuItem>
            )}
            <DropdownMenuItem>Rename</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isFolder && isExpanded && item.children && (
        <div>
          {item.children.map((child) => (
            <FileTreeItem
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
}

export function FileExplorer({
  files,
  activeFileId,
  onFileSelect,
  onNewFile,
}: FileExplorerProps) {
  return (
    <div className="h-full flex flex-col bg-sidebar">
      <div className="h-10 flex items-center justify-between px-3 border-b border-sidebar-border">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onNewFile}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="sr-only">New File</span>
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
        {files.map((item) => (
          <FileTreeItem
            key={item.id}
            item={item}
            depth={0}
            activeFileId={activeFileId}
            onFileSelect={onFileSelect}
          />
        ))}
      </div>
    </div>
  )
}
