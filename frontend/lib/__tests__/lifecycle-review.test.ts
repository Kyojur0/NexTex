import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../store'
import { documentKey, readDraft, writeDraft } from '../drafts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const requestPath = (input: string | URL | Request) => new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).pathname
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(yes => { resolve = yes })
  return { promise, resolve }
}
let workspace = ''
let sequence = 0

beforeEach(() => {
  localStorage.clear()
  workspace = `/lifecycle-review-${++sequence}`
  useEditorStore.setState({
    ...useEditorStore.getInitialState(), workspaceRoot: workspace,
    activeFileId: 'file-a.tex', activeFilePath: 'a.tex',
    content: 'disk content', savedContent: 'disk content', revision: 'disk-revision',
    files: [{ id: 'file-a.tex', name: 'a.tex', path: 'a.tex', type: 'file' }],
  })
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('independent lifecycle regressions', () => {
  it('keeps the draft base revision when recovering across an external edit', async () => {
    writeDraft(workspace, 'a.tex', 'unsaved edit from earlier', 'older-revision')
    useEditorStore.getState().clearActiveFile()
    vi.stubGlobal('fetch', vi.fn(async () => json({ path: 'a.tex', content: 'new external edit', revision: 'external-revision' })))
    await useEditorStore.getState().openFile('file-a.tex', 'a.tex')
    useEditorStore.getState().restoreDraft()
    expect(useEditorStore.getState().revision).toBe('older-revision')
    expect(readDraft(workspace, 'a.tex')?.revision).toBe('older-revision')
  })

  it('retains an undecided recovery draft when the open file is edited', async () => {
    writeDraft(workspace, 'a.tex', 'important recoverable work', 'disk-revision')
    useEditorStore.getState().clearActiveFile()
    vi.stubGlobal('fetch', vi.fn(async () => json({ path: 'a.tex', content: 'disk content', revision: 'disk-revision' })))
    await useEditorStore.getState().openFile('file-a.tex', 'a.tex')
    useEditorStore.getState().setContent('new typing before choosing recover or discard')
    expect(readDraft(workspace, 'a.tex')?.content).toBe('important recoverable work')
  })

  it('updates the active path after a successful rename even if tree refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      return requestPath(input) === '/api/files/rename' ? json({ message: 'Renamed' }) : json({ detail: 'Refresh unavailable' }, 503)
    }))
    await useEditorStore.getState().renameFile('file-a.tex', 'b.tex').catch(() => {})
    expect(useEditorStore.getState().activeFilePath).toBe('b.tex')
    expect(useEditorStore.getState().content).toBe('disk content')
  })

  it('clears a deleted file even when the follow-up tree refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      return requestPath(input) === '/api/files/delete' ? json({ message: 'Deleted' }) : json({ detail: 'Refresh unavailable' }, 503)
    }))
    await useEditorStore.getState().deleteFile('file-a.tex').catch(() => {})
    expect(useEditorStore.getState().activeFilePath).toBeNull()
    expect(useEditorStore.getState().content).toBe('')
  })

  it('waits for an in-flight save before switching workspace after undoing to clean content', async () => {
    const saving = deferred<Response>()
    const requests: string[] = []
    let writeCount = 0
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const path = requestPath(input)
      requests.push(path)
      if (path === '/api/files/write') return writeCount++ === 0 ? saving.promise : json({ revision: 'latest-revision' })
      if (path === '/api/workspace/select') return json({ workspace_root: '/other', trusted_local_mode: true, source: 'user-selected' })
      return json([])
    }))
    useEditorStore.getState().setContent('edit being saved')
    const pendingSave = useEditorStore.getState().saveActiveFile()
    await vi.waitFor(() => expect(requests).toContain('/api/files/write'))
    useEditorStore.getState().setContent('disk content')
    expect(useEditorStore.getState().isModified).toBe(false)
    const navigation = useEditorStore.getState().selectWorkspace('/other', true)
    await Promise.resolve()
    await Promise.resolve()
    const selectedBeforeSaveFinished = requests.includes('/api/workspace/select')
    saving.resolve(json({ revision: 'saved-revision' }))
    await Promise.all([pendingSave, navigation])
    expect(selectedBeforeSaveFinished).toBe(false)
    expect(requests).toEqual(['/api/files/write', '/api/files/write', '/api/workspace/select', '/api/files'])
  })

  it('prevents overlapping reload and open operations from replacing another file', async () => {
    const reading = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn(() => reading.promise))
    const reload = useEditorStore.getState().reloadActiveFile()
    await expect(useEditorStore.getState().openFile('file-b.tex', 'b.tex')).rejects.toThrow('operation is in progress')
    reading.resolve(json({ path: 'a.tex', content: 'new disk content', revision: 'new-revision' }))
    await reload
    expect(useEditorStore.getState().activeFilePath).toBe('a.tex')
    expect(useEditorStore.getState().content).toBe('new disk content')
    expect(useEditorStore.getState().isNavigating).toBe(false)
  })

  it('activates a successfully created document even when the tree refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      return requestPath(input) === '/api/files/create' ? json({ path: 'new.tex', revision: 'new-revision' }) : json({ detail: 'Refresh unavailable' }, 503)
    }))
    await useEditorStore.getState().createDocument('new.tex', 'new document contents').catch(() => {})
    expect(useEditorStore.getState().activeFilePath).toBe('new.tex')
    expect(useEditorStore.getState().content).toBe('new document contents')
    expect(useEditorStore.getState().revision).toBe('new-revision')
    expect(useEditorStore.getState().isModified).toBe(false)
  })

  it('keeps Save As attached to the new saved copy if refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      return requestPath(input) === '/api/files/create' ? json({ path: 'copy.tex', revision: 'copy-revision' }) : json({ detail: 'Refresh unavailable' }, 503)
    }))
    useEditorStore.getState().setContent('unsaved copy')
    await useEditorStore.getState().saveAs('copy.tex').catch(() => {})
    expect(useEditorStore.getState().activeFilePath).toBe('copy.tex')
    expect(useEditorStore.getState().content).toBe('unsaved copy')
    expect(readDraft(workspace, 'a.tex')?.content).toBe('unsaved copy')
  })

  it('requires a recovery decision before saving or building a pending draft', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    writeDraft(workspace, 'a.tex', 'recoverable text', 'disk-revision')
    useEditorStore.setState({ pendingDraft: readDraft(workspace, 'a.tex') })
    await expect(useEditorStore.getState().saveActiveFile()).rejects.toThrow(/Recover or discard/)
    await expect(useEditorStore.getState().compileActiveFile()).rejects.toThrow(/Recover or discard/)
    expect(fetch).not.toHaveBeenCalled()
    expect(readDraft(workspace, 'a.tex')?.content).toBe('recoverable text')
  })

  it('does not turn a recovered draft with unknown revision into an unconditional overwrite', async () => {
    const fetch = vi.fn(async () => json({ revision: 'overwritten' }))
    vi.stubGlobal('fetch', fetch)
    useEditorStore.setState({ pendingDraft: { content: 'old draft', revision: null, updatedAt: 10 } })
    useEditorStore.getState().restoreDraft()
    await expect(useEditorStore.getState().saveActiveFile()).rejects.toThrow(/revision.*unknown/i)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([null, [], { content: 42, revision: null, updatedAt: 10 },
    { content: 'text', updatedAt: 10 }, { content: 'text', revision: 'r', updatedAt: 'yesterday' }])(
    'ignores malformed recovery data: %j', (payload) => {
      localStorage.setItem('nextex-draft:' + documentKey(workspace, 'a.tex'), JSON.stringify(payload))
      expect(readDraft(workspace, 'a.tex')).toBeNull()
    },
  )
})

describe('central source undo history', () => {
  it('undoes text, visual, and AI edits without losing raw LaTeX or crossing modes', () => {
    const original = '\\newcommand{\\custom}{keep me}\n\\section{Original}\nRaw source'
    const typed = original + '\nText edit'
    const visual = typed.replace('Original', 'Visual edit')
    useEditorStore.setState({ content: original, savedContent: original })
    useEditorStore.getState().setContent(typed)
    expect(useEditorStore.getState().canUndo).toBe(true)
    useEditorStore.getState().setActiveEditorTab('visual')
    useEditorStore.getState().setContent(visual)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().content).toBe(typed)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().content).toBe(original)
    expect(useEditorStore.getState().isModified).toBe(false)
    useEditorStore.getState().redo()
    expect(readDraft(workspace, 'a.tex')?.content).toBe(typed)
    useEditorStore.getState().setContent(typed + '\nAI suggestion')
    expect(useEditorStore.getState().canRedo).toBe(false)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().content).toBe(typed)
  })

  it('keeps undo after saving and uses the latest disk revision for its next save', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ revision: 'saved-revision' })))
    useEditorStore.getState().setContent('edited and saved')
    await useEditorStore.getState().saveActiveFile()
    expect(useEditorStore.getState().canUndo).toBe(true)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().content).toBe('disk content')
    expect(useEditorStore.getState().isModified).toBe(true)
    expect(useEditorStore.getState().revision).toBe('saved-revision')
    expect(readDraft(workspace, 'a.tex')?.revision).toBe('saved-revision')
  })

  it('resets source history when opening another document', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => requestPath(input) === '/api/files/write'
      ? json({ revision: 'saved-revision' }) : json({ path: 'b.tex', content: 'other document', revision: 'b-revision' })))
    useEditorStore.getState().setContent('edited')
    await useEditorStore.getState().openFile('file-b.tex', 'b.tex')
    expect(useEditorStore.getState().canUndo).toBe(false)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().content).toBe('other document')
  })

  it('treats recovering a conflicting draft as one reversible source change', () => {
    const draft = { content: 'recovered text', revision: 'old-revision', updatedAt: 10 }
    useEditorStore.setState({ pendingDraft: draft })
    useEditorStore.getState().restoreDraft()
    expect(useEditorStore.getState().canUndo).toBe(true)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().content).toBe('disk content')
    expect(useEditorStore.getState().revision).toBe('disk-revision')
    useEditorStore.getState().redo()
    expect(useEditorStore.getState().content).toBe('recovered text')
    expect(readDraft(workspace, 'a.tex')?.revision).toBe('old-revision')
  })

  it('blocks undo and redo during navigation or an undecided recovery', () => {
    useEditorStore.getState().setContent('edit')
    expect(useEditorStore.getState().canUndo).toBe(true)
    useEditorStore.setState({ isNavigating: true })
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().content).toBe('edit')
    useEditorStore.setState({ isNavigating: false, pendingDraft: { content: 'recovery', revision: 'r', updatedAt: 10 } })
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().content).toBe('edit')
  })

  it('bounds source history and provides an explicit reset for document setup', () => {
    for (let i = 0; i < 150; i++) useEditorStore.getState().setContent(`edit ${i}`)
    expect(useEditorStore.getState().canUndo).toBe(true)
    let steps = 0
    while (useEditorStore.getState().canUndo && steps <= 150) {
      useEditorStore.getState().undo()
      steps++
    }
    expect(steps).toBeLessThanOrEqual(100)
    expect(useEditorStore.getState().content).not.toBe('disk content')
    useEditorStore.getState().resetSourceHistory()
    expect(useEditorStore.getState().canUndo).toBe(false)
    expect(useEditorStore.getState().canRedo).toBe(false)
  })
})
