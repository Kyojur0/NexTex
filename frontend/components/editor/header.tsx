"use client"

import { memo } from "react"
import { useTheme } from "next-themes"
import { useEditorStore, FileItem } from "@/lib/store"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import {
  Sun,
  Moon,
  Monitor,
  FolderOpen,
  File,
  Save,
  Download,
  Settings,
  Play,
  ChevronDown,
  Plus,
  Clock,
  FileText,
  Keyboard,
  PanelRight,
  PanelRightClose,
  Sparkles,
  Folder,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface HeaderProps {
  onOpenFolder: () => void
  onOpenFile: () => void
  onSave: () => void
  onSaveAs: () => void
  onBuild: () => void
  onNewFromTemplate: () => void
  onOpenSettings: () => void
  onTogglePreview: () => void
  showPreview: boolean
}

function formatWorkspacePath(path: string): string {
  if (!path) return ""
  const parts = path.split(/[/\\]/)
  if (parts.length <= 2) return path
  return ".../" + parts.slice(-2).join("/")
}

export const Header = memo(function Header({
  onOpenFolder,
  onOpenFile,
  onSave,
  onSaveAs,
  onBuild,
  onNewFromTemplate,
  onOpenSettings,
  onTogglePreview,
  showPreview,
}: HeaderProps) {
  const projectName = useEditorStore((s) => s.projectName)
  const isModified = useEditorStore((s) => s.isModified)
  const isBuilding = useEditorStore((s) => s.isBuilding)
  const workspaceRoot = useEditorStore((s) => s.workspaceRoot)
  const trustedLocalMode = useEditorStore((s) => s.trustedLocalMode)
  const setShowAISpotlight = useEditorStore((s) => s.setShowAISpotlight)

  return (
    <header
      suppressHydrationWarning
      className={cn(
        "h-12 border-b border-border/60 flex items-center justify-between px-3 select-none shrink-0",
        "bg-gradient-to-b from-background to-secondary/30"
      )}
    >
      {/* Left: Logo + Project */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-foreground shadow-elevated flex items-center justify-center">
            <span className="text-background text-xs font-bold leading-none">N</span>
          </div>
          <span className="font-semibold text-sm tracking-tight hidden sm:block">NexTex</span>
        </div>

        <div className="h-5 w-px bg-border/60 shrink-0" />

        {/* File menus */}
        <nav className="flex items-center gap-1">
          <TopMenu label="File">
            <DropdownMenuItem onClick={onNewFromTemplate}>
              <Plus className="mr-2 h-4 w-4" /> New from Template
              <span className="ml-auto text-xs text-muted-foreground">⌘N</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenFolder}>
              <FolderOpen className="mr-2 h-4 w-4" /> Open Folder
              <span className="ml-auto text-xs text-muted-foreground">⌘O</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenFile}>
              <File className="mr-2 h-4 w-4" /> Open File
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Clock className="mr-2 h-4 w-4" /> Recent Files
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <RecentFilesList />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSave}>
              <Save className="mr-2 h-4 w-4" /> Save
              <span className="ml-auto text-xs text-muted-foreground">⌘S</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSaveAs}>
              <Download className="mr-2 h-4 w-4" /> Save As...
              <span className="ml-auto text-xs text-muted-foreground">⌘⇧S</span>
            </DropdownMenuItem>
          </TopMenu>

          <TopMenu label="Edit">
            <DropdownMenuItem>Undo <span className="ml-auto text-xs text-muted-foreground">⌘Z</span></DropdownMenuItem>
            <DropdownMenuItem>Redo <span className="ml-auto text-xs text-muted-foreground">⌘⇧Z</span></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Find <span className="ml-auto text-xs text-muted-foreground">⌘F</span></DropdownMenuItem>
            <DropdownMenuItem>Replace <span className="ml-auto text-xs text-muted-foreground">⌘H</span></DropdownMenuItem>
          </TopMenu>

          <TopMenu label="Insert">
            <DropdownMenuItem><span className="font-mono text-xs mr-2">\section</span> Section heading</DropdownMenuItem>
            <DropdownMenuItem><span className="font-mono text-xs mr-2">\exp</span> Experience entry</DropdownMenuItem>
            <DropdownMenuItem><span className="font-mono text-xs mr-2">\edu</span> Education entry</DropdownMenuItem>
            <DropdownMenuItem><span className="font-mono text-xs mr-2">\skill</span> Skills row</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem><Keyboard className="mr-2 h-4 w-4" /> All Snippets...</DropdownMenuItem>
          </TopMenu>
        </nav>

        {/* Project name + modified dot + workspace */}
        <div className="flex items-center gap-2 min-w-0 ml-2">
          <span className="text-xs text-muted-foreground truncate max-w-32">{projectName}</span>
          {isModified && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" title="Unsaved changes" />}
          {workspaceRoot && (
            <div className="hidden md:flex items-center gap-1.5 ml-2 text-[10px] text-muted-foreground/70">
              <Folder className="h-3 w-3" />
              <span title={workspaceRoot} className="truncate max-w-40">
                {formatWorkspacePath(workspaceRoot)}
                {trustedLocalMode && (
                  <span className="ml-1 text-[9px] uppercase tracking-wider text-yellow-500/80">Trusted</span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground rounded-lg"
          onClick={() => setShowAISpotlight(true)}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:block">AI</span>
          <span className="hidden sm:block text-muted-foreground/60">⌘K</span>
        </Button>

        <div className="h-5 w-px bg-border/60 mx-0.5" />

        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 w-8 p-0 rounded-lg", !showPreview && "text-muted-foreground")}
          onClick={onTogglePreview}
          aria-label={showPreview ? "Hide preview" : "Show preview"}
        >
          {showPreview ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 rounded-lg"
          onClick={onOpenSettings}
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>

        <ThemeSelector />

        <div className="h-5 w-px bg-border/60 mx-0.5" />

        <Button
          size="sm"
          className="h-8 px-3.5 text-xs font-medium gap-1.5 rounded-lg shadow-elevated"
          onClick={onBuild}
          disabled={isBuilding}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {isBuilding ? "Building..." : "Build"}
        </Button>
      </div>
    </header>
  )
})

function TopMenu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg"
        >
          {label} <ChevronDown className="ml-0.5 h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 rounded-xl border-border/60 shadow-floating">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const ThemeSelector = memo(function ThemeSelector() {
  const { setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" aria-label="Toggle theme">
          <Monitor className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl border-border/60 shadow-floating">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

function RecentFilesList() {
  const recentFiles = useEditorStore((s) => s.recentFiles)
  const openFile = useEditorStore((s) => s.openFile)
  const files = useEditorStore((s) => s.files)

  const findIdByPath = (path: string): string | null => {
    const search = (items: FileItem[]): string | null => {
      for (const item of items) {
        if (item.path === path) return item.id
        if (item.children) {
          const found = search(item.children)
          if (found) return found
        }
      }
      return null
    }
    return search(files)
  }

  if (recentFiles.length === 0) {
    return <DropdownMenuItem disabled>No recent files</DropdownMenuItem>
  }

  return (
    <>
      {recentFiles.map((path) => {
        const id = findIdByPath(path)
        return (
          <DropdownMenuItem
            key={path}
            onClick={() => {
              if (id) openFile(id, path)
            }}
            disabled={!id}
          >
            <FileText className="mr-2 h-4 w-4" />
            {path.split('/').pop() || path}
          </DropdownMenuItem>
        )
      })}
    </>
  )
}
