import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface FileItem {
  id: string
  name: string
  type: 'file' | 'folder'
  path?: string
  children?: FileItem[]
  isMain?: boolean
  content?: string
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
}

export interface FileOperation {
  id: string
  type: 'rename' | 'delete' | 'create'
  itemId?: string
  oldName?: string
  newName?: string
  parentId?: string
}

interface EditorStore {
  // File Management
  files: FileItem[]
  activeFileId: string | null
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
  sidebarWidth: number
  isDragging: boolean
  
  // Settings
  settings: EditorSettings
  
  // Build State
  buildLogs: Array<{
    type: 'info' | 'warning' | 'error' | 'success'
    message: string
    line?: number
    timestamp: string
  }>
  
  // Recent Files
  recentFiles: string[]
  
  // Actions
  setActiveFile: (id: string | null, content: string) => void
  setContent: (content: string) => void
  setIsModified: (value: boolean) => void
  setIsBuilding: (value: boolean) => void
  setHasError: (value: boolean) => void
  setShowBuildLog: (value: boolean) => void
  setShowTemplateModal: (value: boolean) => void
  setShowSettings: (value: boolean) => void
  setSidebarWidth: (width: number) => void
  setIsDragging: (value: boolean) => void
  setSettings: (settings: Partial<EditorSettings>) => void
  setFiles: (files: FileItem[]) => void
  setProjectName: (name: string) => void
  setBuildLogs: (logs: EditorStore['buildLogs']) => void
  addRecentFile: (filePath: string) => void
  
  // File Operations
  renameFile: (id: string, newName: string) => void
  deleteFile: (id: string) => void
  createFile: (parentId: string | null, name: string, type: 'file' | 'folder') => void
  updateFileContent: (id: string, content: string) => void
}

export const useEditorStore = create<EditorStore>()(
  persist(
    (set, get) => ({
      // Initial State
      files: [],
      activeFileId: null,
      projectName: 'Untitled Project',
      content: '',
      isModified: false,
      isBuilding: false,
      hasError: false,
      showBuildLog: true,
      showTemplateModal: false,
      showSettings: false,
      sidebarWidth: 240,
      isDragging: false,
      buildLogs: [],
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
      },
      
      // Actions
      setActiveFile: (id, content) => set({ activeFileId: id, content }),
      setContent: (content) => set({ content }),
      setIsModified: (value) => set({ isModified: value }),
      setIsBuilding: (value) => set({ isBuilding: value }),
      setHasError: (value) => set({ hasError: value }),
      setShowBuildLog: (value) => set({ showBuildLog: value }),
      setShowTemplateModal: (value) => set({ showTemplateModal: value }),
      setShowSettings: (value) => set({ showSettings: value }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setIsDragging: (value) => set({ isDragging: value }),
      setSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      setFiles: (files) => set({ files }),
      setProjectName: (name) => set({ projectName: name }),
      setBuildLogs: (logs) => set({ buildLogs: logs }),
      addRecentFile: (filePath) =>
        set((state) => ({
          recentFiles: [
            filePath,
            ...state.recentFiles.filter((f) => f !== filePath),
          ].slice(0, 10),
        })),
      
      // File Operations
      renameFile: (id, newName) => {
        const state = get()
        const renameInTree = (items: FileItem[]): FileItem[] => {
          return items.map((item) => {
            if (item.id === id) {
              return { ...item, name: newName }
            }
            if (item.children) {
              return { ...item, children: renameInTree(item.children) }
            }
            return item
          })
        }
        set({ files: renameInTree(state.files) })
      },
      
      deleteFile: (id) => {
        const state = get()
        const deleteFromTree = (items: FileItem[]): FileItem[] => {
          return items
            .filter((item) => item.id !== id)
            .map((item) => {
              if (item.children) {
                return { ...item, children: deleteFromTree(item.children) }
              }
              return item
            })
        }
        const newFiles = deleteFromTree(state.files)
        set({
          files: newFiles,
          activeFileId: state.activeFileId === id ? null : state.activeFileId,
        })
      },
      
      createFile: (parentId, name, type) => {
        const state = get()
        const newId = `${type}-${Date.now()}`
        const newItem: FileItem = {
          id: newId,
          name,
          type,
          ...(type === 'folder' && { children: [] }),
        }
        
        const addToTree = (items: FileItem[]): FileItem[] => {
          if (!parentId) {
            return [...items, newItem]
          }
          return items.map((item) => {
            if (item.id === parentId && item.type === 'folder') {
              return {
                ...item,
                children: [...(item.children || []), newItem],
              }
            }
            if (item.children) {
              return { ...item, children: addToTree(item.children) }
            }
            return item
          })
        }
        
        set({ files: addToTree(state.files) })
      },
      
      updateFileContent: (id, content) => {
        const state = get()
        const updateInTree = (items: FileItem[]): FileItem[] => {
          return items.map((item) => {
            if (item.id === id) {
              return { ...item, content }
            }
            if (item.children) {
              return { ...item, children: updateInTree(item.children) }
            }
            return item
          })
        }
        set({ files: updateInTree(state.files) })
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
