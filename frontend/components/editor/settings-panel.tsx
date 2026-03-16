"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  settings: {
    fontSize: number
    tabSize: number
    wordWrap: boolean
    autoSave: boolean
    buildOnSave: boolean
    compiler: string
  }
  onSettingsChange: (settings: SettingsPanelProps["settings"]) => void
}

export function SettingsPanel({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}: SettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState(settings)

  if (!isOpen) return null

  const updateSetting = <K extends keyof typeof settings>(
    key: K,
    value: (typeof settings)[K]
  ) => {
    const newSettings = { ...localSettings, [key]: value }
    setLocalSettings(newSettings)
    onSettingsChange(newSettings)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md mx-4 bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Settings</h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Editor Section */}
          <div>
            <h3 className="text-sm font-medium mb-4">Editor</h3>
            <div className="space-y-4">
              {/* Font Size */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">
                  Font Size
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() =>
                      updateSetting("fontSize", Math.max(10, localSettings.fontSize - 1))
                    }
                  >
                    -
                  </Button>
                  <span className="text-sm w-8 text-center">
                    {localSettings.fontSize}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() =>
                      updateSetting("fontSize", Math.min(24, localSettings.fontSize + 1))
                    }
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Tab Size */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">Tab Size</label>
                <div className="flex gap-1">
                  {[2, 4].map((size) => (
                    <button
                      key={size}
                      className={cn(
                        "h-7 px-3 text-sm rounded transition-colors",
                        localSettings.tabSize === size
                          ? "bg-foreground text-background"
                          : "bg-accent text-foreground hover:bg-accent/80"
                      )}
                      onClick={() => updateSetting("tabSize", size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Word Wrap */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">
                  Word Wrap
                </label>
                <button
                  className={cn(
                    "relative w-10 h-6 rounded-full transition-colors",
                    localSettings.wordWrap ? "bg-foreground" : "bg-muted"
                  )}
                  onClick={() => updateSetting("wordWrap", !localSettings.wordWrap)}
                >
                  <span
                    className={cn(
                      "absolute top-1 w-4 h-4 rounded-full transition-all",
                      localSettings.wordWrap
                        ? "left-5 bg-background"
                        : "left-1 bg-muted-foreground"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Compilation Section */}
          <div>
            <h3 className="text-sm font-medium mb-4">Compilation</h3>
            <div className="space-y-4">
              {/* Compiler */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">
                  Compiler
                </label>
                <select
                  value={localSettings.compiler}
                  onChange={(e) => updateSetting("compiler", e.target.value)}
                  className="h-8 px-3 text-sm bg-accent border border-border rounded outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="pdflatex">pdfLaTeX</option>
                  <option value="xelatex">XeLaTeX</option>
                  <option value="lualatex">LuaLaTeX</option>
                </select>
              </div>

              {/* Auto Save */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">
                  Auto Save
                </label>
                <button
                  className={cn(
                    "relative w-10 h-6 rounded-full transition-colors",
                    localSettings.autoSave ? "bg-foreground" : "bg-muted"
                  )}
                  onClick={() => updateSetting("autoSave", !localSettings.autoSave)}
                >
                  <span
                    className={cn(
                      "absolute top-1 w-4 h-4 rounded-full transition-all",
                      localSettings.autoSave
                        ? "left-5 bg-background"
                        : "left-1 bg-muted-foreground"
                    )}
                  />
                </button>
              </div>

              {/* Build on Save */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-muted-foreground">
                  Build on Save
                </label>
                <button
                  className={cn(
                    "relative w-10 h-6 rounded-full transition-colors",
                    localSettings.buildOnSave ? "bg-foreground" : "bg-muted"
                  )}
                  onClick={() =>
                    updateSetting("buildOnSave", !localSettings.buildOnSave)
                  }
                >
                  <span
                    className={cn(
                      "absolute top-1 w-4 h-4 rounded-full transition-all",
                      localSettings.buildOnSave
                        ? "left-5 bg-background"
                        : "left-1 bg-muted-foreground"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-border bg-muted/30">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}
