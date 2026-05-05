import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as api from './api'

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
  hasError: boolean

  // UI State
  showBuildLog: boolean
  showTemplateModal: boolean
  showSettings: boolean
  showPreview: boolean
  showHistory: boolean
  showAISpotlight: boolean
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
  errorLines: Array<{ line: number; message: string; context: string; severity: string }>
  pdfUrl: string | null

  // Recent Files
  recentFiles: string[]

  // Synchronous Actions
  setContent: (content: string) => void
  setIsModified: (value: boolean) => void
  setIsBuilding: (value: boolean) => void
  setHasError: (value: boolean) => void
  setShowBuildLog: (value: boolean) => void
  setShowTemplateModal: (value: boolean) => void
  setShowSettings: (value: boolean) => void
  setShowPreview: (value: boolean) => void
  setShowHistory: (value: boolean) => void
  setShowAISpotlight: (value: boolean) => void
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
      hasError: false,
      showBuildLog: false,
      showTemplateModal: false,
      showSettings: false,
      showPreview: true,
      showHistory: false,
      showAISpotlight: false,
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

      setContent: (content) => set({ content, errorLines: [] }),
      setIsModified: (value) => set({ isModified: value }),
      setActiveFile: (id, content) => set({ activeFileId: id, content, isModified: false }),
      setIsBuilding: (value) => set({ isBuilding: value }),
      setHasError: (value) => set({ hasError: value }),
      setShowBuildLog: (value) => set({ showBuildLog: value }),
      setShowTemplateModal: (value) => set({ showTemplateModal: value }),
      setShowSettings: (value) => set({ showSettings: value }),
      setShowPreview: (value) => set({ showPreview: value }),
      setShowHistory: (value) => set({ showHistory: value }),
      setShowAISpotlight: (value) => set({ showAISpotlight: value }),
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
      clearActiveFile: () => set({ activeFileId: null, activeFilePath: null, content: '', isModified: false }),
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
        })
        await get().refreshFiles()
      },

      selectWorkspace: async (path, trusted) => {
        const info = await api.selectWorkspace(path, trusted)
        set({
          workspaceRoot: info.workspace_root,
          trustedLocalMode: info.trusted_local_mode,
          activeFileId: null,
          activeFilePath: null,
          content: '',
          isModified: false,
          pdfUrl: null,
        })
        await get().refreshFiles()
      },

      resetWorkspace: async () => {
        const info = await api.resetWorkspace()
        set({
          workspaceRoot: info.workspace_root,
          trustedLocalMode: info.trusted_local_mode,
          activeFileId: null,
          activeFilePath: null,
          content: '',
          isModified: false,
          pdfUrl: null,
        })
        await get().refreshFiles()
      },

      refreshFiles: async () => {
        const tree = await api.fetchFileTree('')
        set({ files: tree.map(apiNodeToFileItem) })
      },

      openFile: async (id, path) => {
        const content = await api.readFile(path)
        set({
          activeFileId: id,
          activeFilePath: path,
          content,
          isModified: false,
        })
        get().addRecentFile(path)
      },

      saveActiveFile: async () => {
        const { activeFilePath, content } = get()
        if (!activeFilePath) return
        await api.writeFile(activeFilePath, content)
        set({ isModified: false })
      },

      renameFile: async (id, newName) => {
        const { files, activeFileId, activeFilePath } = get()
        const oldPath = findFilePath(files, id) || pathFromId(id)
        const parentPath = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/')) : ''
        const newPath = parentPath ? `${parentPath}/${newName}` : newName
        await api.renameItem(oldPath, newPath)
        await get().refreshFiles()
        // Update active file if it was the renamed one
        if (activeFileId === id) {
          const newId = id.startsWith('folder-') ? `folder-${newPath}` : `file-${newPath}`
          set({ activeFileId: newId, activeFilePath: newPath })
        }
      },

      deleteFile: async (id) => {
        const { files, activeFileId } = get()
        const path = findFilePath(files, id) || pathFromId(id)
        await api.deleteItem(path)
        await get().refreshFiles()
        if (activeFileId === id) {
          set({ activeFileId: null, activeFilePath: null, content: '', isModified: false })
        }
      },

      createFile: async (parentId, name, type) => {
        const { files } = get()
        const parentPath = parentId ? (findFilePath(files, parentId) || pathFromId(parentId)) : ''
        const path = parentPath ? `${parentPath}/${name}` : name
        await api.createItem(path, type)
        await get().refreshFiles()
      },

      compileActiveFile: async () => {
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
            pdfUrl: result.pdf_available ? api.getPdfUrl(result.build_id) : null,
          })
        } catch (err: any) {
          set({
            buildLogs: [
              ...get().buildLogs,
              { type: 'error', message: err?.message || 'Compilation failed', timestamp: new Date().toLocaleTimeString() },
            ],
            errorLines: [],
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
