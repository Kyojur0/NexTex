import { useEffect } from 'react'
import { useEditorStore } from '@/lib/store'
import { recordSnapshot } from '@/lib/version-db'

/** One owner for persistence, independent of whether the history pane is open. */
export function useDocumentLifecycle() {
  useEffect(() => {
    let saveTimer: ReturnType<typeof setTimeout> | undefined
    let historyTimer: ReturnType<typeof setTimeout> | undefined
    const snapshot = () => {
      const state = useEditorStore.getState()
      if (!state.activeFilePath) return
      void recordSnapshot(state.workspaceRoot, state.activeFilePath, state.content).catch(() => {
        state.setLastError('Version history is unavailable in this browser. Your document can still be saved to disk.')
      })
    }
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (state.content === previous.content && state.activeFilePath === previous.activeFilePath &&
          state.isModified === previous.isModified && state.settings === previous.settings && state.lastError === previous.lastError) return
      clearTimeout(saveTimer)
      if (state.settings.autoSave && state.isModified && state.activeFilePath && !state.lastError) {
        saveTimer = setTimeout(() => {
          const current = useEditorStore.getState()
          void current.saveActiveFile().then(() => {
            if (useEditorStore.getState().settings.buildOnSave) return useEditorStore.getState().compileActiveFile()
          }).catch((error: unknown) => current.setLastError(error instanceof Error ? error.message : 'Save failed'))
        }, 2000)
      }
      if (state.content !== previous.content || state.activeFilePath !== previous.activeFilePath) {
        clearTimeout(historyTimer)
        historyTimer = setTimeout(snapshot, 10000)
      }
    })
    const periodicHistory = setInterval(snapshot, 120000)
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (useEditorStore.getState().isModified) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      unsubscribe(); clearTimeout(saveTimer); clearTimeout(historyTimer); clearInterval(periodicHistory)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [])
}
