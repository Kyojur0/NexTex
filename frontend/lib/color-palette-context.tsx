"use client"

import { createContext, useContext, useEffect, useCallback, useMemo } from 'react'
import { useEditorStore } from '@/lib/store'

export const ColorPaletteContext = createContext<{
  palette: string
  setPalette: (palette: string) => void
} | null>(null)

export function ColorPaletteProvider({ children }: { children: React.ReactNode }) {
  const colorPalette = useEditorStore((s) => s.settings.colorPalette)
  const setSettings = useEditorStore((s) => s.setSettings)

  useEffect(() => {
    // Apply color palette to root and html element
    const htmlElement = document.documentElement
    htmlElement.setAttribute('data-color-palette', colorPalette)
    // Also apply to body to ensure children inherit
    document.body.setAttribute('data-color-palette', colorPalette)
  }, [colorPalette])

  const setPalette = useCallback((palette: string) => {
    setSettings({ colorPalette: palette as any })
  }, [setSettings])

  const value = useMemo(() => ({ palette: colorPalette, setPalette }), [colorPalette, setPalette])

  return (
    <ColorPaletteContext.Provider value={value}>
      <div data-color-palette={colorPalette} suppressHydrationWarning>
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
