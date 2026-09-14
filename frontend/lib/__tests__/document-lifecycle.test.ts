import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import { useEditorStore } from '../store'
import { recordSnapshot, moveFileHistory } from '../version-db'

vi.mock('../api')
vi.mock('../version-db', () => ({
  recordSnapshot: vi.fn().mockResolvedValue(undefined),
  moveFileHistory: vi.fn().mockResolvedValue(undefined),
}))

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(recordSnapshot).mockResolvedValue(undefined)
  vi.mocked(moveFileHistory).mockResolvedValue(undefined)
  localStorage.clear()
  useEditorStore.setState({
    workspaceRoot: '/project', activeFileId: 'file-a.tex', activeFilePath: 'a.tex',
    content: 'original', savedContent: 'original', revision: 'r0',
    isModified: false, isSaving: false, isBuilding: false, lastError: null,
    pdfUrl: null, files: [{ id: 'file-a.tex', path: 'a.tex', name: 'a.tex', type: 'file' }],
  } as Partial<ReturnType<typeof useEditorStore.getState>>)
  vi.mocked(api.fetchFileTree).mockResolvedValue([])
})

describe('safe document lifecycle', () => {
  it('keeps edits made during a save dirty, then saves them with the returned revision', async () => {
    const write = deferred<{ revision: string }>()
    vi.mocked(api.writeFile).mockReturnValueOnce(write.promise as never)
    useEditorStore.getState().setContent('first edit')
    useEditorStore.getState().setIsModified(true)
    const saving = useEditorStore.getState().saveActiveFile()
    await Promise.resolve()
    useEditorStore.getState().setContent('newer edit')
    write.resolve({ revision: 'r1' })
    await saving
    expect(useEditorStore.getState().isModified).toBe(true)
    expect(useEditorStore.getState().content).toBe('newer edit')
    vi.mocked(api.writeFile).mockResolvedValueOnce({ revision: 'r2' } as never)
    await useEditorStore.getState().saveActiveFile()
    expect(api.writeFile).toHaveBeenLastCalledWith('a.tex', 'newer edit', 'r1')
    expect(useEditorStore.getState().isModified).toBe(false)
  })

  it('never compiles an older on-disk document before saving edits', async () => {
    const calls: string[] = []
    vi.mocked(api.writeFile).mockImplementation((async () => { calls.push('save'); return { revision: 'r1' } }) as never)
    vi.mocked(api.compileLaTeX).mockImplementation(async () => {
      calls.push('compile')
      return { success: true, logs: [], error_lines: [], pdf_available: true, build_id: 'build', pdf_url: '/pdf', build_dir: '/tmp/build' } as api.CompileResult
    })
    useEditorStore.getState().setContent('edited')
    useEditorStore.getState().setIsModified(true)
    await useEditorStore.getState().compileActiveFile()
    expect(calls).toEqual(['save', 'compile'])
  })

  it('preserves the buffer and blocks navigation if saving fails', async () => {
    vi.mocked(api.writeFile).mockRejectedValueOnce(new Error('File changed on disk'))
    vi.mocked(api.readFile).mockResolvedValue('other')
    useEditorStore.getState().setContent('unsaved')
    useEditorStore.getState().setIsModified(true)
    await expect(useEditorStore.getState().openFile('file-b.tex', 'b.tex')).rejects.toThrow('File changed on disk')
    expect(useEditorStore.getState().content).toBe('unsaved')
    expect(useEditorStore.getState().activeFilePath).toBe('a.tex')
  })

  it('moves an active descendant path when its folder is renamed', async () => {
    useEditorStore.setState({
      activeFileId: 'file-chapters/a.tex', activeFilePath: 'chapters/a.tex',
      files: [{ id: 'folder-chapters', name: 'chapters', path: 'chapters', type: 'folder' }],
    })
    vi.mocked(api.renameItem).mockResolvedValue(undefined)
    await useEditorStore.getState().renameFile('folder-chapters', 'parts')
    expect(useEditorStore.getState().activeFilePath).toBe('parts/a.tex')
  })

  it('clears the active descendant and PDF when deleting its folder', async () => {
    useEditorStore.setState({
      activeFileId: 'file-chapters/a.tex', activeFilePath: 'chapters/a.tex', pdfUrl: '/old.pdf',
      files: [{ id: 'folder-chapters', name: 'chapters', path: 'chapters', type: 'folder' }],
    })
    vi.mocked(api.deleteItem).mockResolvedValue(undefined)
    await useEditorStore.getState().deleteFile('folder-chapters')
    expect(useEditorStore.getState().activeFilePath).toBeNull()
    expect(useEditorStore.getState().pdfUrl).toBeNull()
  })
})
