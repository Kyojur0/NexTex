import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VisualEditor } from '@/components/editor/visual-editor'
import { useEditorStore } from '@/lib/store'

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  useEditorStore.setState({content:'Hello world.',activeFilePath:'one.tex',isModified:false})
  useEditorStore.getState().resetSourceHistory()
})
afterEach(cleanup)
function edit(el: HTMLElement, text: string) { el.textContent = text; el.innerText = text; fireEvent.input(el) }

describe('visual document edits', () => {
  it('synchronizes input before unmounting', () => {
    const {container,unmount} = render(<VisualEditor />)
    edit(container.querySelector<HTMLElement>('[contenteditable]')!, 'Changed.')
    expect(useEditorStore.getState().content).toBe('Changed.')
    unmount()
    expect(useEditorStore.getState().content).toBe('Changed.')
  })
  it('undoes and redoes edits through the toolbar', () => {
    const {container} = render(<VisualEditor />)
    edit(container.querySelector<HTMLElement>('[contenteditable]')!, 'Changed.')
    fireEvent.click(screen.getByTitle('Undo'))
    expect(useEditorStore.getState().content).toBe('Hello world.')
    fireEvent.click(screen.getByTitle('Redo'))
    expect(useEditorStore.getState().content).toBe('Changed.')
  })
  it('resets history when another file has identical content', () => {
    const {container} = render(<VisualEditor />)
    edit(container.querySelector<HTMLElement>('[contenteditable]')!, 'Changed.')
    act(() => {
      useEditorStore.setState({activeFilePath:'two.tex',content:'Changed.',isModified:false})
      useEditorStore.getState().resetSourceHistory()
    })
    expect(screen.getByTitle('Undo')).toBeDisabled()
    expect(useEditorStore.getState().content).toBe('Changed.')
  })
  it('handles menu insertion inside the document wrapper', () => {
    useEditorStore.setState({content:'\\documentclass{article}\n\\begin{document}\nHello.\n\\end{document}\n'})
    render(<VisualEditor />)
    act(() => window.dispatchEvent(new CustomEvent('editor:command',{detail:{command:'insert',text:'\\section{Inserted}'}})))
    const source = useEditorStore.getState().content
    expect(source).toContain('\\section{Inserted}')
    expect(source.indexOf('\\section{Inserted}')).toBeLessThan(source.indexOf('\\end{document}'))
  })
  it('offers keyboard-accessible block movement', () => {
    useEditorStore.setState({content:'First.\n\nSecond.'})
    const {container} = render(<VisualEditor />)
    fireEvent.click(container.querySelector('[data-testid="block-card"]')!)
    fireEvent.click(screen.getByTitle('Move down'))
    expect(useEditorStore.getState().content).toContain('Second.\n\nFirst.')
  })
  it('keeps multirow merges valid when a row is inserted inside them', () => {
    useEditorStore.setState({content:'\\begin{table}[h]\n\\centering\n\\begin{tabular}{l|l}\n\\hline\n\\multirow{2}{*}{A} & B \\\\\n & C \\\\\n\\hline\n\\end{tabular}\n\\caption{}\n\\end{table}'})
    const {container} = render(<VisualEditor />)
    fireEvent.click(container.querySelector('[data-testid="block-card"]')!)
    fireEvent.click(screen.getByTitle('Add row above row 2'))
    expect(useEditorStore.getState().content).toContain('\\multirow{3}{*}{A}')
  })
  it('does not rewrite untouched inline macros when focus leaves a paragraph', () => {
    const source = 'An \\emph{original} phrase.'
    useEditorStore.setState({content:source})
    const {container} = render(<VisualEditor />)
    const editor = container.querySelector<HTMLElement>('[contenteditable]')!
    fireEvent.focus(editor); fireEvent.blur(editor)
    expect(useEditorStore.getState().content).toBe(source)
    expect(screen.getByTitle('Undo')).toBeDisabled()
  })
  it.each([['Superscript','textsuperscript'],['Subscript','textsubscript'],['Bold (Ctrl+B)','textbf']])('applies %s to the selected text', (title,command) => {
    const {container} = render(<VisualEditor />)
    const editor = container.querySelector<HTMLElement>('[contenteditable]')!
    const range = document.createRange(); range.setStart(editor.firstChild!,0); range.setEnd(editor.firstChild!,5)
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
    fireEvent.click(screen.getByTitle(title))
    expect(useEditorStore.getState().content).toBe(`\\${command}{Hello} world.`)
  })
  it('navigates and replaces an individual find result', () => {
    useEditorStore.setState({content:'First word.\n\nSecond word.'})
    render(<VisualEditor />)
    act(() => window.dispatchEvent(new CustomEvent('editor:command',{detail:{command:'replace'}})))
    fireEvent.change(screen.getByLabelText('Find LaTeX'),{target:{value:'word'}})
    fireEvent.click(screen.getByRole('button',{name:'Next match'}))
    fireEvent.change(screen.getByLabelText('Replacement'),{target:{value:'result'}})
    fireEvent.click(screen.getByRole('button',{name:'Replace match'}))
    expect(useEditorStore.getState().content).toBe('First word.\n\nSecond result.')
  })
  it('consumes slash commands when inserting a new block', () => {
    const {container} = render(<VisualEditor />)
    const editor = container.querySelector<HTMLElement>('[contenteditable]')!
    const range = document.createRange(); range.selectNodeContents(editor); range.collapse(false)
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
    fireEvent.keyDown(editor,{key:'/'})
    edit(editor,'Hello world./')
    range.selectNodeContents(editor); range.collapse(false); selection.removeAllRanges(); selection.addRange(range)
    fireEvent.click(screen.getByRole('button',{name:'Equation'}))
    expect(useEditorStore.getState().content).not.toContain('world./')
    expect(useEditorStore.getState().content).toContain('\\begin{equation}')
  })
  it('splits a list item at the caret on Enter', () => {
    useEditorStore.setState({content:'\\begin{itemize}\n  \\item Alpha beta\n\\end{itemize}'})
    const {container} = render(<VisualEditor />)
    const editor = container.querySelector<HTMLElement>('[contenteditable]')!
    const range = document.createRange(); range.setStart(editor.firstChild!,6); range.collapse(true)
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
    fireEvent.keyDown(editor,{key:'Enter'})
    expect(useEditorStore.getState().content).toContain('\\item Alpha\n  \\item beta')
  })
  it('preserves undo after switching away and back without changing documents', () => {
    const first = render(<VisualEditor />)
    edit(first.container.querySelector<HTMLElement>('[contenteditable]')!, 'Changed.')
    first.unmount()
    render(<VisualEditor />)
    fireEvent.click(screen.getByTitle('Undo'))
    expect(useEditorStore.getState().content).toBe('Hello world.')
  })
  it.each(['% Example: \\begin{document}\n','% \\usepackage[normalem]{ulem}\n'])('inserts dependencies outside preamble comments', (comment) => {
    const source = '\\documentclass{article}\n' + comment + '\\begin{document}\nHello.\n\\end{document}\n'
    useEditorStore.setState({content:source})
    const {container} = render(<VisualEditor />)
    const editor = container.querySelector<HTMLElement>('[data-latex-editor]')!
    const range = document.createRange(); range.selectNodeContents(editor)
    const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
    fireEvent.click(screen.getByTitle('Strikethrough'))
    expect(useEditorStore.getState().content).toBe('\\documentclass{article}\n' + comment + '\\usepackage[normalem]{ulem}\n\\begin{document}\n\\sout{Hello.}\n\\end{document}\n')
  })
})
