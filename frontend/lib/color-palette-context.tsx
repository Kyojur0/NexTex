"use client"

import { createContext, useContext, useEffect } from 'react'
import { useEditorStore } from '@/lib/store'

export const ColorPaletteContext = createContext<{
  palette: string
  setPalette: (palette: string) => void
} | null>(null)

export function ColorPaletteProvider({ children }: { children: React.ReactNode }) {
  const { settings, setSettings } = useEditorStore()

  useEffect(() => {
    // Apply color palette to root and html element
    const htmlElement = document.documentElement
    htmlElement.setAttribute('data-color-palette', settings.colorPalette)
    // Also apply to body to ensure children inherit
    document.body.setAttribute('data-color-palette', settings.colorPalette)
  }, [settings.colorPalette])

  const setPalette = (palette: string) => {
    setSettings({ colorPalette: palette as any })
  }

  return (
    <ColorPaletteContext.Provider value={{ palette: settings.colorPalette, setPalette }}>
      <div data-color-palette={settings.colorPalette} suppressHydrationWarning>
        {children}
      </div>
    </ColorPaletteContext.Provider>
  )
}

export function useColorPalette() {
  const context = useContext(ColorPaletteContext)
  if (!context) {
    throw new Error('useColorPalette must be used within ColorPaletteProvider')
  }
  return context
}
