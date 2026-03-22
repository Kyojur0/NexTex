"use client"

import { memo, useCallback } from "react"
import { useTheme } from "next-themes"
import { useEditorStore } from "@/lib/store"
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

const ThemeSelector = memo(function ThemeSelector() {
  const { setTheme } = useTheme()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Toggle theme">
          <Monitor className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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

export function Header({
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
  const { projectName, isModified, isBuilding, setShowAISpotlight } = useEditorStore()

  return (
    <header
      suppressHydrationWarning
      className="h-11 border-b border-border bg-background flex items-center justify-between px-3 select-none shrink-0"
    >
      {/* Left: Logo + Project */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-5 h-5 rounded bg-foreground flex items-center justify-center">
            <span className="text-background text-[10px] font-bold leading-none">T</span>
          </div>
          <span className="font-semibold text-sm tracking-tight hidden sm:block">TeXPress</span>
        </div>

        <div className="h-4 w-px bg-border shrink-0" />

        {/* File menus */}
        <nav className="flex items-center gap-0.5">
          {/* File menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                File <ChevronDown className="ml-0.5 h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
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
                  <DropdownMenuItem><FileText className="mr-2 h-4 w-4" /> resume.tex</DropdownMenuItem>
                  <DropdownMenuItem><FileText className="mr-2 h-4 w-4" /> cover-letter.tex</DropdownMenuItem>
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
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Edit menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                Edit <ChevronDown className="ml-0.5 h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem>Undo <span className="ml-auto text-xs text-muted-foreground">⌘Z</span></DropdownMenuItem>
              <DropdownMenuItem>Redo <span className="ml-auto text-xs text-muted-foreground">⌘⇧Z</span></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Find <span className="ml-auto text-xs text-muted-foreground">⌘F</span></DropdownMenuItem>
              <DropdownMenuItem>Replace <span className="ml-auto text-xs text-muted-foreground">⌘H</span></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Insert menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                Insert <ChevronDown className="ml-0.5 h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem><span className="font-mono text-xs mr-2">\section</span> Section heading</DropdownMenuItem>
              <DropdownMenuItem><span className="font-mono text-xs mr-2">\exp</span> Experience entry</DropdownMenuItem>
              <DropdownMenuItem><span className="font-mono text-xs mr-2">\edu</span> Education entry</DropdownMenuItem>
              <DropdownMenuItem><span className="font-mono text-xs mr-2">\skill</span> Skills row</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem><Keyboard className="mr-2 h-4 w-4" /> All Snippets...</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Project name + modified dot */}
        <div className="flex items-center gap-1.5 min-w-0 ml-1">
          <span className="text-xs text-muted-foreground truncate max-w-32">{projectName}</span>
          {isModified && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1 shrink-0">
        {/* AI Spotlight */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setShowAISpotlight(true)}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:block">AI</span>
          <span className="hidden sm:block text-muted-foreground/60">⌘K</span>
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Preview toggle */}
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 w-7 p-0", !showPreview && "text-muted-foreground")}
          onClick={onTogglePreview}
          aria-label={showPreview ? "Hide preview" : "Show preview"}
        >
          {showPreview ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
        </Button>

        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onOpenSettings}>
          <Settings className="h-4 w-4" />
        </Button>

        <ThemeSelector />

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          size="sm"
          className="h-7 px-3 text-xs font-medium gap-1.5"
          onClick={onBuild}
          disabled={isBuilding}
        >
          <Play className="h-3 w-3" />
          {isBuilding ? "Building..." : "Build"}
        </Button>
      </div>
    </header>
  )
}
