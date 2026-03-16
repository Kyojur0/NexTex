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
} from "lucide-react"

interface HeaderProps {
  onOpenFolder: () => void
  onOpenFile: () => void
  onSave: () => void
  onSaveAs: () => void
  onBuild: () => void
  onNewFromTemplate: () => void
  onOpenSettings: () => void
}

const ThemeSelector = memo(function ThemeSelector() {
  const { setTheme } = useTheme()

  const handleThemeChange = useCallback((newTheme: string) => {
    setTheme(newTheme)
  }, [setTheme])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <Monitor className="h-4 w-4" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleThemeChange("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeChange("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeChange("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

const FileMenu = memo(function FileMenu({
  onNewFromTemplate,
  onOpenFolder,
  onOpenFile,
  onSave,
  onSaveAs,
}: Pick<HeaderProps, 'onNewFromTemplate' | 'onOpenFolder' | 'onOpenFile' | 'onSave' | 'onSaveAs'>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-medium">
          File
          <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem onClick={onNewFromTemplate}>
          <Plus className="mr-2 h-4 w-4" />
          New from Template
          <span className="ml-auto text-xs text-muted-foreground">Cmd+N</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenFolder}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Open Folder
          <span className="ml-auto text-xs text-muted-foreground">Cmd+O</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenFile}>
          <File className="mr-2 h-4 w-4" />
          Open File
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Clock className="mr-2 h-4 w-4" />
            Recent Files
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>
              <FileText className="mr-2 h-4 w-4" />
              resume.tex
            </DropdownMenuItem>
            <DropdownMenuItem>
              <FileText className="mr-2 h-4 w-4" />
              cover-letter.tex
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSave}>
          <Save className="mr-2 h-4 w-4" />
          Save
          <span className="ml-auto text-xs text-muted-foreground">Cmd+S</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSaveAs}>
          <Download className="mr-2 h-4 w-4" />
          Save As...
          <span className="ml-auto text-xs text-muted-foreground">Cmd+Shift+S</span>
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
}: HeaderProps) {
  const { projectName, isModified, isBuilding } = useEditorStore()

  const handleBuild = useCallback(() => {
    onBuild()
  }, [onBuild])

  const handleOpenSettings = useCallback(() => {
    onOpenSettings()
  }, [onOpenSettings])

  return (
    <header suppressHydrationWarning className="h-12 border-b border-border bg-background flex items-center justify-between px-4 select-none transition-colors">
      {/* Left: Logo and Project Name */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded bg-foreground flex items-center justify-center">
            <span className="text-background text-xs font-bold">T</span>
          </div>
          <span className="font-semibold text-sm tracking-tight">TeXPress</span>
        </div>
        
        <div className="h-4 w-px bg-border shrink-0" />
        
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm text-muted-foreground truncate">
            {projectName}
          </span>
          {isModified && (
            <span className="w-2 h-2 rounded-full bg-foreground/50 shrink-0" />
          )}
        </div>
      </div>

      {/* Center: Menu Items */}
      <nav className="flex items-center gap-1 flex-1 justify-center px-4">
        <FileMenu
          onNewFromTemplate={onNewFromTemplate}
          onOpenFolder={onOpenFolder}
          onOpenFile={onOpenFile}
          onSave={onSave}
          onSaveAs={onSaveAs}
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-medium">
              Edit
              <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem>
              Undo
              <span className="ml-auto text-xs text-muted-foreground">Cmd+Z</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              Redo
              <span className="ml-auto text-xs text-muted-foreground">Cmd+Shift+Z</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              Find
              <span className="ml-auto text-xs text-muted-foreground">Cmd+F</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              Replace
              <span className="ml-auto text-xs text-muted-foreground">Cmd+H</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-medium">
              Insert
              <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem>
              Section
              <span className="ml-auto text-xs text-muted-foreground">\\section</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              Experience Entry
              <span className="ml-auto text-xs text-muted-foreground">\\exp</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              Education Entry
              <span className="ml-auto text-xs text-muted-foreground">\\edu</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              Skills Row
              <span className="ml-auto text-xs text-muted-foreground">\\skill</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Keyboard className="mr-2 h-4 w-4" />
              All Snippets...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={handleOpenSettings}
        >
          <Settings className="h-4 w-4" />
          <span className="sr-only">Settings</span>
        </Button>

        <ThemeSelector />

        <div className="h-4 w-px bg-border" />

        <Button
          size="sm"
          className="h-7 px-3 text-xs font-medium gap-1.5"
          onClick={handleBuild}
          disabled={isBuilding}
        >
          <Play className="h-3 w-3" />
          {isBuilding ? "Compiling..." : "Compile"}
        </Button>
      </div>
    </header>
  )
}
