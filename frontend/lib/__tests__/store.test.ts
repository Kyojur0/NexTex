import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../store'

describe('Editor store', () => {
  beforeEach(() => {
    // Reset store to initial state by calling setters
    const store = useEditorStore.getState()
    store.setContent('')
    store.setIsModified(false)
    store.setIsBuilding(false)
    store.setShowBuildLog(false)
    store.setPdfUrl(null)
    store.setBuildLogs([])
    store.clearActiveFile()
    store.setFiles([])
    store.setSettings({
      fontSize: 14,
      tabSize: 2,
      wordWrap: true,
      autoSave: true,
      buildOnSave: false,
      compiler: 'pdflatex',
      colorPalette: 'monochrome',
      enableSyntaxHighlight: false,
      aiModel: 'openai/gpt-4o-mini',
      aiProvider: 'openai',
    })
  })

  it('has correct initial state', () => {
    const state = useEditorStore.getState()
    expect(state.content).toBe('')
    expect(state.isModified).toBe(false)
    expect(state.activeFileId).toBeNull()
    expect(state.settings.autoSave).toBe(true)
    expect(state.settings.compiler).toBe('pdflatex')
  })

  it('setContent updates content', () => {
    useEditorStore.getState().setContent('hello')
    expect(useEditorStore.getState().content).toBe('hello')
  })

  it('setIsModified updates flag', () => {
    useEditorStore.getState().setIsModified(true)
    expect(useEditorStore.getState().isModified).toBe(true)
  })

  it('setSettings merges partial settings', () => {
    useEditorStore.getState().setSettings({ fontSize: 20 })
    expect(useEditorStore.getState().settings.fontSize).toBe(20)
    expect(useEditorStore.getState().settings.tabSize).toBe(2)
  })

  it('setBuildLogs updates logs', () => {
    const logs = [{ type: 'info' as const, message: 'test', timestamp: '12:00' }]
    useEditorStore.getState().setBuildLogs(logs)
    expect(useEditorStore.getState().buildLogs).toHaveLength(1)
  })

  it('addRecentFile deduplicates and limits to 10', () => {
    const store = useEditorStore.getState()
    for (let i = 0; i < 12; i++) {
      store.addRecentFile(`file-${i}.tex`)
    }
    const recent = useEditorStore.getState().recentFiles
    expect(recent).toHaveLength(10)
    expect(recent[0]).toBe('file-11.tex')
  })

  it('clearActiveFile resets file state', () => {
    const store = useEditorStore.getState()
    store.setContent('test')
    store.setIsModified(true)
    store.clearActiveFile()
    expect(useEditorStore.getState().content).toBe('')
    expect(useEditorStore.getState().isModified).toBe(false)
    expect(useEditorStore.getState().activeFileId).toBeNull()
  })

  it('setPdfUrl updates pdf url', () => {
    useEditorStore.getState().setPdfUrl('http://example.com/pdf')
    expect(useEditorStore.getState().pdfUrl).toBe('http://example.com/pdf')
  })
})
