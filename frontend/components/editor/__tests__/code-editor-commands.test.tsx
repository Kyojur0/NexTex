import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EnhancedCodeEditor } from '../enhanced-code-editor'
import { useEditorStore } from '@/lib/store'

vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light' }) }))

function seedSource(content = 'alpha beta alpha', path = 'test.tex') {
  useEditorStore.setState({ content, savedContent: content, workspaceRoot: 'test-workspace', activeFilePath: path, activeFileId: `file-${path}`, isModified: false, isNavigating: false, pendingDraft: null })
  useEditorStore.getState().resetSourceHistory()
}

function Editor() {
  const content = useEditorStore((state) => state.content)
  const documentId = useEditorStore((state) => `${state.workspaceRoot}:${state.activeFilePath}`)
  return <EnhancedCodeEditor content={content} onChange={(next) => useEditorStore.getState().setContent(next)} documentId={documentId} fileName="test.tex" wordWrap={false} />
}

function command(command: string, text?: string) {
  act(() => window.dispatchEvent(new CustomEvent('editor:command', { detail: { command, text } })))
}

describe('code editor commands', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
    seedSource()
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  it('inserts at the selection and reverses both programmatic and typed changes', () => {
    seedSource('hello world')
    render(<Editor />)
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement
    editor.focus()
    editor.setSelectionRange(6, 11)
    command('insert', 'LaTeX')
    expect(editor.value).toBe('hello LaTeX')
    command('undo')
    expect(editor.value).toBe('hello world')
    command('redo')
    expect(editor.value).toBe('hello LaTeX')
    fireEvent.change(editor, { target: { value: 'hello LaTeX!' } })
    fireEvent.keyDown(editor, { key: 'z', metaKey: true })
    expect(editor.value).toBe('hello LaTeX')
    fireEvent.keyDown(editor, { key: 'z', metaKey: true, shiftKey: true })
    expect(editor.value).toBe('hello LaTeX!')
  })

  it('opens find, selects matches, and replaces all matches with a single undo step', () => {
    render(<Editor />)
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.keyDown(editor, { key: 'h', ctrlKey: true })
    fireEvent.change(screen.getByLabelText('Find text'), { target: { value: 'alpha' } })
    fireEvent.change(screen.getByLabelText('Replace with'), { target: { value: 'gamma' } })
    expect(screen.getByText('2 matches')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next match' }))
    expect(editor.value.slice(editor.selectionStart, editor.selectionEnd)).toBe('alpha')
    fireEvent.click(screen.getByRole('button', { name: 'Replace all' }))
    expect(editor.value).toBe('gamma beta gamma')
    command('undo')
    expect(editor.value).toBe('alpha beta alpha')
  })

  it('handles literal replacement text and ignores shortcuts in unrelated inputs', () => {
    seedSource('a.b a.b')
    render(<><input aria-label="Elsewhere" /><Editor /></>)
    fireEvent.keyDown(screen.getByLabelText('Elsewhere'), { key: 'f', metaKey: true })
    expect(screen.queryByLabelText('Find text')).not.toBeInTheDocument()
    command('replace')
    fireEvent.change(screen.getByLabelText('Find text'), { target: { value: 'a.b' } })
    fireEvent.change(screen.getByLabelText('Replace with'), { target: { value: '$&' } })
    fireEvent.click(screen.getByRole('button', { name: 'Replace all' }))
    expect((screen.getByLabelText('LaTeX source') as HTMLTextAreaElement).value).toBe('$& $&')
  })

  it('resets undo history when moving to a different document with the same filename', () => {
    seedSource('first', 'a/test.tex')
    render(<Editor />)
    command('insert', 'edit')
    act(() => seedSource('second', 'b/test.tex'))
    command('undo')
    expect(useEditorStore.getState().canUndo).toBe(false)
    expect(screen.getByLabelText('LaTeX source')).toHaveValue('second')
  })

  it('shares one undo sequence with edits made while the source editor is unmounted', () => {
    seedSource('before')
    const source = render(<Editor />)
    fireEvent.change(screen.getByLabelText('LaTeX source'), { target: { value: 'typed in source' } })
    source.unmount()
    // The visual editor, AI review, and version restoration all use this same action.
    act(() => useEditorStore.getState().setContent('edited visually'))
    render(<Editor />)
    command('undo')
    expect(screen.getByLabelText('LaTeX source')).toHaveValue('typed in source')
    command('undo')
    expect(screen.getByLabelText('LaTeX source')).toHaveValue('before')
    expect(useEditorStore.getState().canUndo).toBe(false)
    command('redo')
    expect(screen.getByLabelText('LaTeX source')).toHaveValue('typed in source')
    command('redo')
    expect(screen.getByLabelText('LaTeX source')).toHaveValue('edited visually')
    expect(useEditorStore.getState().canRedo).toBe(false)
  })
})
