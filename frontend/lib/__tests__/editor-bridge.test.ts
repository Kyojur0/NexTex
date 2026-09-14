import { webcrypto } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../store'
import { executeEditorCommand, editorSnapshot } from '../editor-bridge'

async function args() {
  const state = editorSnapshot()
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(state.content))
  return { expected_workspace_root: state.workspace_root, expected_path: state.path,
    expected_content_sha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('') }
}
const command = (action: string, values: Record<string, unknown>) =>
  executeEditorCommand({ type: 'command', id: 'test', action, args: values, expires_at: Date.now() + 10000 })

describe('MCP editor commands', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto)
    localStorage.clear()
    useEditorStore.setState({ workspaceRoot: '/workspace', activeFileId: 'paper.tex', activeFilePath: 'paper.tex',
      content: 'Original π', savedContent: 'Original π', revision: 'disk-revision', isModified: false,
      isNavigating: false, isSaving: false, isBuilding: false, pendingDraft: null, lastError: null,
      sourceHistory: { past: [], future: [] }, canUndo: false, canRedo: false, activeEditorTab: 'text' })
  })

  it('reads unsaved source and applies one undoable edit', async () => {
    const result = await command('set_content', { ...await args(), content: 'Agent edit' })
    expect(result.content).toBe('Agent edit')
    expect(result.is_modified).toBe(true)
    expect(result.can_undo).toBe(true)
    await command('undo', await args())
    expect(useEditorStore.getState().content).toBe('Original π')
    await command('redo', await args())
    expect(useEditorStore.getState().content).toBe('Agent edit')
  })

  it('rejects stale source and wrong document identity', async () => {
    const stale = await args()
    useEditorStore.getState().setContent('Human edit')
    await expect(command('set_content', { ...stale, content: 'Lost update' })).rejects.toThrow(/changed/)
    await expect(command('set_content', { ...await args(), expected_path: 'other.tex', content: 'Wrong' })).rejects.toThrow(/changed/)
    expect(useEditorStore.getState().content).toBe('Human edit')
  })

  it('rejects pending recovery and expired/unknown commands', async () => {
    useEditorStore.setState({ pendingDraft: { content: 'Recovered',
      revision: 'disk-revision', updatedAt: Date.now() } })
    await expect(command('set_content', { ...await args(), content: 'Overwrite' })).rejects.toThrow(/draft/i)
    await expect(command('eval', {})).rejects.toThrow(/Unsupported/)
    await expect(executeEditorCommand({ type: 'command', id: 'x', action: 'read', args: {}, expires_at: 0 })).rejects.toThrow(/expired/)
  })

  it('uses existing save and build operations', async () => {
    const save = vi.spyOn(useEditorStore.getState(), 'saveActiveFile').mockResolvedValue()
    await command('save', await args())
    expect(save).toHaveBeenCalledOnce()
    save.mockRestore()
    const build = vi.spyOn(useEditorStore.getState(), 'compileActiveFile').mockResolvedValue()
    await command('build', await args())
    expect(build).toHaveBeenCalledOnce()
    build.mockRestore()
  })
})
