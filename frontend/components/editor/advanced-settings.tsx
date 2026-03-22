"use client"

import { memo, useCallback } from "react"
import { useEditorStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface AdvancedSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ColorPaletteSwatch = memo(function ColorPaletteSwatch({
  name,
  value,
  selected,
  colors,
  onClick,
}: {
  name: string
  value: string
  selected: boolean
  colors: { light: string; dark: string }
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer",
        selected ? "border-foreground" : "border-border hover:border-muted-foreground"
      )}
    >
      <span className="text-xs font-medium">{name}</span>
      <div className="flex gap-1">
        <div
          className="w-4 h-4 rounded border border-foreground/20"
          style={{ backgroundColor: colors.light }}
        />
        <div
          className="w-4 h-4 rounded border border-foreground/20"
          style={{ backgroundColor: colors.dark }}
        />
      </div>
    </button>
  )
})

export const AdvancedSettings = memo(function AdvancedSettings({
  open,
  onOpenChange,
}: AdvancedSettingsProps) {
  const { settings, setSettings } = useEditorStore()

  const handleFontSizeChange = useCallback(
    (value: string) => {
      setSettings({ fontSize: parseInt(value) })
    },
    [setSettings]
  )

  const handleTabSizeChange = useCallback(
    (value: string) => {
      setSettings({ tabSize: parseInt(value) })
    },
    [setSettings]
  )

  const handleCompilerChange = useCallback(
    (value: string) => {
      setSettings({ compiler: value as any })
    },
    [setSettings]
  )

  const handlePaletteChange = useCallback(
    (palette: string) => {
      setSettings({ colorPalette: palette as any })
    },
    [setSettings]
  )

  const handleToggleChange = useCallback(
    (key: 'wordWrap' | 'autoSave' | 'buildOnSave' | 'enableSyntaxHighlight', value: boolean) => {
      setSettings({ [key]: value })
    },
    [setSettings]
  )

  const palettes = [
    {
      name: "Monochrome",
      value: "monochrome",
      colors: { light: "#1a1a1a", dark: "#f5f5f5" },
    },
    {
      name: "Blue",
      value: "blue",
      colors: { light: "#2c5aa0", dark: "#60a5fa" },
    },
    {
      name: "Emerald",
      value: "emerald",
      colors: { light: "#059669", dark: "#10b981" },
    },
    {
      name: "Warm",
      value: "warm",
      colors: { light: "#d97706", dark: "#fbbf24" },
    },
    {
      name: "Minimal",
      value: "minimal",
      colors: { light: "#525252", dark: "#d4d4d8" },
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize your editor experience and appearance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Color Palettes */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Color Palette</Label>
            <p className="text-xs text-muted-foreground">
              Choose a color scheme. Light/Dark modes work with each palette.
            </p>
            <div className="grid grid-cols-5 gap-3">
              {palettes.map((palette) => (
                <ColorPaletteSwatch
                  key={palette.value}
                  name={palette.name}
                  value={palette.value}
                  selected={settings.colorPalette === palette.value}
                  colors={palette.colors}
                  onClick={() => handlePaletteChange(palette.value)}
                />
              ))}
            </div>
          </div>

          {/* Editor Settings */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Editor</h3>

            <div className="space-y-2">
              <Label htmlFor="font-size">Font Size</Label>
              <Select value={settings.fontSize.toString()} onValueChange={handleFontSizeChange}>
                <SelectTrigger id="font-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[12, 13, 14, 15, 16, 18, 20].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tab-size">Tab Size</Label>
              <Select value={settings.tabSize.toString()} onValueChange={handleTabSizeChange}>
                <SelectTrigger id="tab-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 8].map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size} spaces
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="word-wrap">Word Wrap</Label>
              <Switch
                id="word-wrap"
                checked={settings.wordWrap}
                onCheckedChange={(checked) =>
                  handleToggleChange("wordWrap", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="syntax-highlight">Syntax Highlighting</Label>
              <Switch
                id="syntax-highlight"
                checked={settings.enableSyntaxHighlight}
                onCheckedChange={(checked) =>
                  handleToggleChange("enableSyntaxHighlight", checked)
                }
              />
            </div>
          </div>

          {/* AI Settings */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold">AI Assistant</h3>
            <p className="text-xs text-muted-foreground">
              Choose the model powering the AI Spotlight (Cmd+K). Use the Vercel AI Gateway models below.
            </p>

            <div className="space-y-2">
              <Label htmlFor="ai-provider">Provider</Label>
              <Select
                value={settings.aiProvider}
                onValueChange={(v) => {
                  const defaults: Record<string, string> = {
                    openai: "openai/gpt-4o-mini",
                    anthropic: "anthropic/claude-3-5-haiku",
                    google: "google/gemini-2.0-flash",
                    xai: "xai/grok-3-mini",
                  }
                  setSettings({ aiProvider: v as any, aiModel: defaults[v] || defaults.openai })
                }}
              >
                <SelectTrigger id="ai-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="xai">xAI (Grok)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-model">Model</Label>
              <Select value={settings.aiModel} onValueChange={(v) => setSettings({ aiModel: v })}>
                <SelectTrigger id="ai-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {settings.aiProvider === "openai" && (
                    <>
                      <SelectItem value="openai/gpt-4o-mini">GPT-4o Mini (fast)</SelectItem>
                      <SelectItem value="openai/gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="openai/gpt-5">GPT-5</SelectItem>
                    </>
                  )}
                  {settings.aiProvider === "anthropic" && (
                    <>
                      <SelectItem value="anthropic/claude-3-5-haiku">Claude 3.5 Haiku (fast)</SelectItem>
                      <SelectItem value="anthropic/claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                      <SelectItem value="anthropic/claude-opus-4.6">Claude Opus 4.6</SelectItem>
                    </>
                  )}
                  {settings.aiProvider === "google" && (
                    <>
                      <SelectItem value="google/gemini-2.0-flash">Gemini 2.0 Flash (fast)</SelectItem>
                      <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                    </>
                  )}
                  {settings.aiProvider === "xai" && (
                    <>
                      <SelectItem value="xai/grok-3-mini">Grok 3 Mini (fast)</SelectItem>
                      <SelectItem value="xai/grok-3">Grok 3</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Compiler Settings */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-semibold">Compiler</h3>

            <div className="space-y-2">
              <Label htmlFor="compiler">LaTeX Engine</Label>
              <Select value={settings.compiler} onValueChange={handleCompilerChange}>
                <SelectTrigger id="compiler">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdflatex">pdfLaTeX</SelectItem>
                  <SelectItem value="xetex">XeTeX</SelectItem>
                  <SelectItem value="luatex">LuaTeX</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="auto-save">Auto Save</Label>
              <Switch
                id="auto-save"
                checked={settings.autoSave}
                onCheckedChange={(checked) =>
                  handleToggleChange("autoSave", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="build-on-save">Build on Save</Label>
              <Switch
                id="build-on-save"
                checked={settings.buildOnSave}
                onCheckedChange={(checked) =>
                  handleToggleChange("buildOnSave", checked)
                }
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
})
