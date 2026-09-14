import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as api from './api'
import { readDraft, removeDraft, writeDraft, type Draft } from './drafts'
import { moveFileHistory, recordSnapshot } from './version-db'

let saveQueue: Promise<void> = Promise.resolve()
let openRequest = 0
const includesPath = (parent: string, child: string | null) => !!child && (child === parent || child.startsWith(parent + '/'))
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'An unexpected error occurred'
const recoveryDecisionMessage = 'Recover or discard the available draft before editing this document.'

interface SourceSnapshot { content: string; revision: string | null }
interface SourceHistory { past: SourceSnapshot[]; future: SourceSnapshot[] }
const emptySourceHistory = () => ({ sourceHistory: { past: [], future: [] } as SourceHistory, canUndo: false, canRedo: false })

function boundedSnapshots(snapshots: SourceSnapshot[]): SourceSnapshot[] {
  const retained = snapshots.slice(-100)
  let characters = retained.reduce((total, snapshot) => total + snapshot.content.length, 0)
  while (retained.length > 1 && characters > 5_000_000) characters -= retained.shift()!.content.length
  return retained
}

function historyAfterEdit(state: EditorStore) {
  const past = boundedSnapshots([...state.sourceHistory.past, { content: state.content, revision: state.revision }])
  return { sourceHistory: { past, future: [] }, canUndo: past.length > 0, canRedo: false }
}

function persistEditedDraft(workspace: string, path: string | null, content: string, revision: string | null) {
  if (!path) return
  try { writeDraft(workspace, path, content, revision) }
  catch { useEditorStore.setState({ lastError: 'Recovery storage is full. Save your document to keep these changes.' }) }
}

function requireRecoveryDecision(state: EditorStore) {
  if (!state.pendingDraft) return
  useEditorStore.setState({ lastError: recoveryDecisionMessage })
  throw new Error(recoveryDecisionMessage)
}

function stepSourceHistory(direction: 'undo' | 'redo') {
  const state = useEditorStore.getState()
  if (state.isNavigating || state.pendingDraft) return
  const { past, future } = state.sourceHistory
  const target = (direction === 'undo' ? past : future).at(-1)
  if (!target) return
  const current = { content: state.content, revision: state.revision }
  const history = direction === 'undo'
    ? { past: past.slice(0, -1), future: boundedSnapshots([...future, current]) }
    : { past: boundedSnapshots([...past, current]), future: future.slice(0, -1) }
  useEditorStore.setState({ content: target.content, revision: target.revision,
    isModified: target.content !== state.savedContent, errorLines: [], lastError: null,
    sourceHistory: history, canUndo: history.past.length > 0, canRedo: history.future.length > 0 })
  persistEditedDraft(state.workspaceRoot, state.activeFilePath, target.content, target.revision)
}

async function saveBeforeNavigation() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const outstandingSaves = saveQueue
    await outstandingSaves.catch(() => {})
    if (saveQueue !== outstandingSaves) continue
    const state = useEditorStore.getState()
    if (state.isBuilding) throw new Error('Wait for the current build to finish before changing files.')
    if (!state.isModified) return
    if (!state.activeFilePath) throw new Error('Use Save As to save this document first.')
    await state.saveActiveFile()
  }
  throw new Error('Pause typing for a moment so the latest changes can be saved.')
}

export interface FileItem {
  id: string
  name: string
  type: 'file' | 'folder'
  path: string
  children?: FileItem[]
}

export interface EditorSettings {
  fontSize: number
  tabSize: number
  wordWrap: boolean
  autoSave: boolean
  buildOnSave: boolean
  compiler: 'pdflatex' | 'xetex' | 'luatex'
  colorPalette: 'monochrome' | 'blue' | 'emerald' | 'warm' | 'minimal'
  enableSyntaxHighlight: boolean
  aiModel: string
  aiProvider: 'openai' | 'anthropic' | 'google' | 'xai'
}


async function navigate(action: () => Promise<void>): Promise<void> {
  if (useEditorStore.getState().isNavigating) throw new Error('A file operation is in progress. Please wait.')
  useEditorStore.setState({ isNavigating: true, canUndo: false, canRedo: false })
  try { await action() }
  catch (error) { useEditorStore.setState({ lastError: messageOf(error) }); throw error }
  finally {
    const state = useEditorStore.getState()
    useEditorStore.setState({ isNavigating: false,
      canUndo: !state.pendingDraft && state.sourceHistory.past.length > 0,
      canRedo: !state.pendingDraft && state.sourceHistory.future.length > 0 })
  }
}

async function loadDocument(id: string, path: string): Promise<void> {
        const request = ++openRequest
        const workspace = useEditorStore.getState().workspaceRoot
        const document = await api.readDocument(path)
        if (request !== openRequest || useEditorStore.getState().workspaceRoot !== workspace) return
        const draft = readDraft(workspace, path)
        useEditorStore.setState({
          activeFileId: id,
          activeFilePath: path,
          content: document.content,
          savedContent: document.content,
          revision: document.revision,
          isModified: false,
          pdfUrl: null,
          errorLines: [],
          buildLogs: [],
          lastError: null,
          pendingDraft: draft && draft.content !== document.content ? draft : null,
          ...emptySourceHistory(),
        })
        useEditorStore.getState().addRecentFile(path)
        void recordSnapshot(workspace, path, document.content, 'Opened', true).catch(() => {})
}

function apiNodeToFileItem(node: api.FileNode): FileItem {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    path: node.path,
    children: node.children?.map(apiNodeToFileItem),
  }
}

function pathFromId(id: string): string {
  if (id.startsWith('file-')) return id.slice(5)
  if (id.startsWith('folder-')) return id.slice(7)
  return id
}

function findFilePath(items: FileItem[], id: string): string | null {
  for (const item of items) {
    if (item.id === id) return item.path
    if (item.children) {
      const found = findFilePath(item.children, id)
      if (found) return found
    }
  }
  return null
}

interface EditorStore {
  // Workspace
  workspaceRoot: string
  trustedLocalMode: boolean

  // File Management
  files: FileItem[]
  activeFileId: string | null
  activeFilePath: string | null
  projectName: string

  // Editor State
  content: string
  isModified: boolean
  isBuilding: boolean
  isNavigating: boolean
  isSaving: boolean
  savedContent: string
  revision: string | null
  lastError: string | null
  pendingDraft: Draft | null
  sourceHistory: SourceHistory
  canUndo: boolean
  canRedo: boolean
  hasError: boolean

  // UI State
  showBuildLog: boolean
  showTemplateModal: boolean
  showSettings: boolean
  showPreview: boolean
  showHistory: boolean
  showAISpotlight: boolean
  showVisualLatexPanel: boolean
  sidebarWidth: number
  isDragging: boolean
  activeEditorTab: 'text' | 'visual'

  // Settings
  settings: EditorSettings

  // Build State
  buildLogs: Array<{
    type: 'info' | 'warning' | 'error' | 'success'
    message: string
    line?: number
    timestamp: string
  }>
  errorLines: Array<{ line: number; message: string; context: string; severity: string; file?: string }>
  pdfUrl: string | null

  // Recent Files
  recentFiles: string[]

  // Synchronous Actions
  setContent: (content: string) => void
  undo: () => void
  redo: () => void
  resetSourceHistory: () => void
  setIsModified: (value: boolean) => void
  setIsBuilding: (value: boolean) => void
  setHasError: (value: boolean) => void
  setShowBuildLog: (value: boolean) => void
  setShowTemplateModal: (value: boolean) => void
  setShowSettings: (value: boolean) => void
  setShowPreview: (value: boolean) => void
  setShowHistory: (value: boolean) => void
  setShowAISpotlight: (value: boolean) => void
  setShowVisualLatexPanel: (value: boolean) => void
  setSidebarWidth: (width: number) => void
  setIsDragging: (value: boolean) => void
  setActiveEditorTab: (tab: 'text' | 'visual') => void
  setSettings: (settings: Partial<EditorSettings>) => void
  setBuildLogs: (logs: EditorStore['buildLogs']) => void
  setErrorLines: (lines: EditorStore['errorLines']) => void
  setPdfUrl: (url: string | null) => void
  setFiles: (files: FileItem[]) => void
  setProjectName: (name: string) => void
  setActiveFile: (id: string | null, content: string) => void
  addRecentFile: (filePath: string) => void
  clearActiveFile: () => void

  // Async Actions
  loadWorkspace: () => Promise<void>
  selectWorkspace: (path: string, trusted: boolean) => Promise<void>
  resetWorkspace: () => Promise<void>
  refreshFiles: () => Promise<void>
  openFile: (id: string, path: string) => Promise<void>
  saveActiveFile: () => Promise<void>
  renameFile: (id: string, newName: string) => Promise<void>
  deleteFile: (id: string) => Promise<void>
  createFile: (parentId: string | null, name: string, type: 'file' | 'folder') => Promise<void>
  compileActiveFile: () => Promise<void>
  createDocument: (path: string, content: string) => Promise<void>
  saveAs: (path: string) => Promise<void>
  reloadActiveFile: () => Promise<void>
  restoreDraft: () => void
  dismissDraft: () => void
  setLastError: (error: string | null) => void
}

export const useEditorStore = create<EditorStore>()(
  persist(
    (set, get) => ({
      // Initial State
      workspaceRoot: '',
      trustedLocalMode: false,
      files: [],
      activeFileId: null,
      activeFilePath: null,
      projectName: 'Untitled Project',
      content: '',
      isModified: false,
      isBuilding: false,
      isNavigating: false,
      isSaving: false,
      savedContent: '',
      revision: null,
      lastError: null,
      pendingDraft: null,
      ...emptySourceHistory(),
      hasError: false,
      showBuildLog: false,
      showTemplateModal: false,
      showSettings: false,
      showPreview: true,
      showHistory: false,
      showAISpotlight: false,
      showVisualLatexPanel: true,
      sidebarWidth: 240,
      isDragging: false,
      activeEditorTab: 'text',
      buildLogs: [],
      errorLines: [],
      pdfUrl: null,
      recentFiles: [],
      settings: {
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
      },

      setContent: (content) => {
        const state = get()
        if (state.isNavigating || content === state.content) return
        if (state.pendingDraft) {
          set({ lastError: recoveryDecisionMessage })
          return
        }
        set({ content, isModified: content !== state.savedContent, errorLines: [], lastError: null, ...historyAfterEdit(state) })
        persistEditedDraft(state.workspaceRoot, state.activeFilePath, content, state.revision)
      },
      undo: () => stepSourceHistory('undo'),
      redo: () => stepSourceHistory('redo'),
      resetSourceHistory: () => set(emptySourceHistory()),
      setLastError: (lastError) => set({ lastError }),
      setIsModified: (value) => set({ isModified: value }),
      setActiveFile: (id, content) => set({ activeFileId: id, content, isModified: false, ...emptySourceHistory() }),
      setIsBuilding: (value) => set({ isBuilding: value }),
      setHasError: (value) => set({ hasError: value }),
      setShowBuildLog: (value) => set({ showBuildLog: value }),
      setShowTemplateModal: (value) => set({ showTemplateModal: value }),
      setShowSettings: (value) => set({ showSettings: value }),
      setShowPreview: (value) => set({ showPreview: value }),
      setShowHistory: (value) => set({ showHistory: value }),
      setShowAISpotlight: (value) => set({ showAISpotlight: value }),
      setShowVisualLatexPanel: (value) => set({ showVisualLatexPanel: value }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setIsDragging: (value) => set({ isDragging: value }),
      setActiveEditorTab: (tab) => set({ activeEditorTab: tab }),
      setSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      setBuildLogs: (logs) => set({ buildLogs: logs }),
      setErrorLines: (lines) => set({ errorLines: lines }),
      setPdfUrl: (url) => set({ pdfUrl: url }),
      setFiles: (files) => set({ files }),
      setProjectName: (name) => set({ projectName: name }),
      clearActiveFile: () => {
        ++openRequest
        set({ activeFileId: null, activeFilePath: null, content: '', savedContent: '', revision: null,
          isModified: false, pdfUrl: null, errorLines: [], buildLogs: [], pendingDraft: null, ...emptySourceHistory() })
      },
      addRecentFile: (filePath) =>
        set((state) => ({
          recentFiles: [
            filePath,
            ...state.recentFiles.filter((f) => f !== filePath),
          ].slice(0, 10),
        })),

      // Async Actions
      loadWorkspace: async () => {
        const info = await api.getWorkspace()
        set({
          workspaceRoot: info.workspace_root,
          trustedLocalMode: info.trusted_local_mode,
          projectName: info.workspace_root.split('/').filter(Boolean).pop() || 'Workspace',
          ...(get().workspaceRoot !== info.workspace_root ? emptySourceHistory() : {}),
        })
        await get().refreshFiles()
      },

      selectWorkspace: async (path, trusted) => navigate(async () => {
        await saveBeforeNavigation()
        const info = await api.selectWorkspace(path, trusted)
        get().clearActiveFile()
        set({
          workspaceRoot: info.workspace_root,
          trustedLocalMode: info.trusted_local_mode,
          activeFileId: null,
          activeFilePath: null,
          content: '',
          isModified: false,
          pdfUrl: null,
          recentFiles: [],
          projectName: info.workspace_root.split('/').filter(Boolean).pop() || 'Workspace',
        })
        await get().refreshFiles()
      }),

      resetWorkspace: async () => navigate(async () => {
        await saveBeforeNavigation()
        const info = await api.resetWorkspace()
        get().clearActiveFile()
        set({
          workspaceRoot: info.workspace_root,
          trustedLocalMode: info.trusted_local_mode,
          activeFileId: null,
          activeFilePath: null,
          content: '',
          isModified: false,
          pdfUrl: null,
          recentFiles: [],
          projectName: info.workspace_root.split('/').filter(Boolean).pop() || 'Workspace',
        })
        await get().refreshFiles()
      }),

      refreshFiles: async () => {
        const tree = await api.fetchFileTree('')
        set({ files: tree.map(apiNodeToFileItem) })
      },

      openFile: async (id, path) => navigate(async () => {
        if (get().activeFilePath === path) return
        await saveBeforeNavigation()
        await loadDocument(id, path)
      }),

      saveActiveFile: async () => {
        requireRecoveryDecision(get())
        const { activeFilePath, content, workspaceRoot } = get()
        if (!activeFilePath) return
        const operation = saveQueue.catch(() => {}).then(async () => {
          const current = get()
          if (current.activeFilePath !== activeFilePath || current.workspaceRoot !== workspaceRoot) return
          requireRecoveryDecision(current)
          if (content === current.savedContent && !current.isModified) return
          if (current.revision === null) {
            const message = 'The file revision is unknown. Reload from disk or use Save As before saving.'
            set({ lastError: message })
            throw new Error(message)
          }
          set({ isSaving: true, lastError: null })
          try {
            const result = await api.writeFile(activeFilePath, content, current.revision)
            if (get().activeFilePath === activeFilePath && get().workspaceRoot === workspaceRoot) {
              const clean = get().content === content
              const history = get().sourceHistory
              set({ revision: result.revision, savedContent: content, isModified: !clean,
                sourceHistory: {
                  past: history.past.map(snapshot => ({ ...snapshot, revision: result.revision })),
                  future: history.future.map(snapshot => ({ ...snapshot, revision: result.revision })),
                } })
              if (clean) removeDraft(workspaceRoot, activeFilePath)
              else writeDraft(workspaceRoot, activeFilePath, get().content, result.revision)
            }
            void recordSnapshot(workspaceRoot, activeFilePath, content, 'Saved', true).catch(() => {})
          } catch (error) {
            set({ lastError: messageOf(error) })
            throw error
          } finally { set({ isSaving: false }) }
        })
        saveQueue = operation
        return operation
      },

      renameFile: async (id, newName) => navigate(async () => {
        if (!newName.trim() || /[/\\]/.test(newName) || newName === '.' || newName === '..') throw new Error('Enter a filename without slashes.')
        await saveBeforeNavigation()
        const { files, activeFilePath } = get()
        const oldPath = findFilePath(files, id) || pathFromId(id)
        const parentPath = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/')) : ''
        const newPath = parentPath ? `${parentPath}/${newName}` : newName
        await api.renameItem(oldPath, newPath)
        // Update active file if it was the renamed one
        if (includesPath(oldPath, activeFilePath)) {
          const moved = newPath + activeFilePath!.slice(oldPath.length)
          set({ activeFileId: `file-${moved}`, activeFilePath: moved, pdfUrl: null, ...emptySourceHistory() })
        }
        set({ recentFiles: get().recentFiles.map((path) => includesPath(oldPath, path) ? newPath + path.slice(oldPath.length) : path) })
        await moveFileHistory(get().workspaceRoot, oldPath, newPath).catch(() => {})
        await get().refreshFiles()
      }),

      deleteFile: async (id) => navigate(async () => {
        await saveBeforeNavigation()
        const { files, activeFilePath, workspaceRoot } = get()
        const path = findFilePath(files, id) || pathFromId(id)
        await api.deleteItem(path)
        if (includesPath(path, activeFilePath)) {
          removeDraft(workspaceRoot, activeFilePath!)
          get().clearActiveFile()
        }
        set({ recentFiles: get().recentFiles.filter((recent) => !includesPath(path, recent)) })
        await get().refreshFiles()
      }),

      createFile: async (parentId, name, type) => navigate(async () => {
        const { files } = get()
        const parentPath = parentId ? (findFilePath(files, parentId) || pathFromId(parentId)) : ''
        const path = parentPath ? `${parentPath}/${name}` : name
        await api.createItem(path, type)
        await get().refreshFiles()
      }),

      createDocument: async (path, content) => navigate(async () => {
        await saveBeforeNavigation()
        const workspace = get().workspaceRoot
        const result = await api.createDocumentFile(path, content)
        ++openRequest
        set({ activeFileId: `file-${path}`, activeFilePath: path, content, savedContent: content,
          revision: result.revision, isModified: false, pdfUrl: null, errorLines: [], buildLogs: [],
          lastError: null, pendingDraft: null, ...emptySourceHistory() })
        get().addRecentFile(path)
        void recordSnapshot(workspace, path, content, 'Created', false).catch(() => {})
        await get().refreshFiles()
      }),

      saveAs: async (path) => navigate(async () => {
        requireRecoveryDecision(get())
        if (get().isBuilding) throw new Error('Wait for the current build to finish.')
        if (path === get().activeFilePath) { await get().saveActiveFile(); return }
        const { content, workspaceRoot } = get()
        const result = await api.createDocumentFile(path, content)
        // The original buffer remains recoverable if it was dirty.
        ++openRequest
        set({ activeFilePath: path, activeFileId: `file-${path}`, savedContent: content,
          revision: result.revision, isModified: get().content !== content, pdfUrl: null, lastError: null, pendingDraft: null, ...emptySourceHistory() })
        get().addRecentFile(path)
        void recordSnapshot(workspaceRoot, path, content, 'Save As', false).catch(() => {})
        await get().refreshFiles()
      }),

      reloadActiveFile: async () => navigate(async () => {
        const { activeFilePath, workspaceRoot } = get()
        if (!activeFilePath) return
        const document = await api.readDocument(activeFilePath)
        removeDraft(workspaceRoot, activeFilePath)
        set({ content: document.content, savedContent: document.content, revision: document.revision,
          isModified: false, lastError: null, pendingDraft: null, pdfUrl: null, ...emptySourceHistory() })
      }),
      restoreDraft: () => {
        const state = get()
        const draft = state.pendingDraft
        if (draft && !state.isNavigating) {
          const conflict = draft.revision !== state.revision
          set({ content: draft.content, isModified: draft.content !== state.savedContent,
            pendingDraft: null, revision: draft.revision, errorLines: [],
            ...historyAfterEdit(state),
            lastError: conflict ? 'Recovered draft: the file has also changed on disk. Save a copy to keep both versions.' : null })
          if (state.activeFilePath) {
            try { writeDraft(state.workspaceRoot, state.activeFilePath, draft.content, draft.revision) }
            catch { set({ lastError: 'Recovery storage is full. Save a copy to keep the recovered document.' }) }
          }
        }
      },
      dismissDraft: () => {
        const state = get()
        if (state.activeFilePath) removeDraft(state.workspaceRoot, state.activeFilePath)
        set({ pendingDraft: null, ...(state.lastError === recoveryDecisionMessage ? { lastError: null } : {}) })
      },

      compileActiveFile: async () => {
        if (get().isBuilding || get().isNavigating) return
        requireRecoveryDecision(get())
        await saveBeforeNavigation()
        const { activeFilePath, settings } = get()
        if (!activeFilePath) return
        set({ isBuilding: true, showBuildLog: true, pdfUrl: null, errorLines: [] })
        const ts = new Date().toLocaleTimeString()
        set({
          buildLogs: [
            { type: 'info', message: `Starting ${settings.compiler} compilation...`, timestamp: ts },
            { type: 'info', message: `Processing ${activeFilePath}`, timestamp: ts },
          ],
        })
        try {
          const result = await api.compileLaTeX(activeFilePath, settings.compiler)
          const logs = result.logs.map((l) => ({
            type: l.type as 'info' | 'warning' | 'error' | 'success',
            message: l.message,
            timestamp: new Date().toLocaleTimeString(),
          }))
          set({
            buildLogs: logs,
            errorLines: result.error_lines || [],
            hasError: !result.success,
            pdfUrl: result.pdf_available ? api.getPdfUrl(result.build_id) : null,
          })
        } catch (err: any) {
          set({
            buildLogs: [
              ...get().buildLogs,
              { type: 'error', message: err?.message || 'Compilation failed', timestamp: new Date().toLocaleTimeString() },
            ],
            errorLines: [],
            hasError: true,
            lastError: messageOf(err),
          })
        } finally {
          set({ isBuilding: false })
        }
      },
    }),
    {
      name: 'editor-store',
      partialize: (state) => ({
        settings: state.settings,
        recentFiles: state.recentFiles,
        projectName: state.projectName,
      }),
    }
  )
)
