import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InlineText } from './components/inline-text'
import { applyInlineFormat } from './inline'
import { LatexOutputPanel } from '@/components/editor/latex-output-panel'

describe('LaTeX rich text', () => {
  it('renders nested formatting and links as semantic markup', () => {
    const {container} = render(<InlineText value={'Hello \\textbf{bold \\textit{and italic}} \\href{https://example.org}{link}.'} />)
    expect(container.querySelector('strong')).toHaveTextContent('bold and italic')
    expect(container.querySelector('strong em')).toHaveTextContent('and italic')
    expect(container.querySelector('a')).toHaveAttribute('href','https://example.org')
  })
  it('serializes formatted input and escapes typed special characters', () => {
    const onChange = vi.fn()
    const {container} = render(<InlineText onChange={onChange} />)
    const editor = container.querySelector('[contenteditable]')!
    editor.innerHTML = '<strong>Bold &amp; brave</strong><em> italic</em><u> under</u><s> strike</s><code> code</code><sup>2</sup><sub>n</sub><a href="https://example.org"> site</a>'
    fireEvent.input(editor)
    expect(onChange).toHaveBeenLastCalledWith('\\textbf{Bold \\& brave}\\textit{ italic}\\underline{ under}\\sout{ strike}\\texttt{ code}\\textsuperscript{2}\\textsubscript{n}\\href{https://example.org}{ site}')
  })
  it('renders escaped literal characters without exposing HTML', () => {
    const {container} = render(<InlineText value={'A \\& B <script>alert(1)</script> \\%'} />)
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('[contenteditable]')).toHaveTextContent('A & B <script>alert(1)</script> %')
  })
  it('allows a single-line plugin to handle Enter before suppressing a newline', () => {
    const onKeyDown = vi.fn()
    const {container} = render(<InlineText multiline={false} onKeyDown={onKeyDown} />)
    fireEvent.keyDown(container.querySelector('[contenteditable]')!, {key:'Enter'})
    expect(onKeyDown).toHaveBeenCalledOnce()
  })
  it('preserves escaped URL fragments when adjacent text is edited', () => {
    const onChange = vi.fn()
    const source = '\\href{https://example.org/\\#section}{Link}'
    const {container} = render(<InlineText value={source} onChange={onChange} />)
    const editor = container.querySelector('[contenteditable]')!
    editor.append(document.createTextNode(' added'))
    fireEvent.input(editor)
    expect(onChange).toHaveBeenLastCalledWith(source + ' added')
    expect(container.querySelector('a')).toHaveAttribute('href','https://example.org/#section')
  })
  it('toggles bold at a caret for subsequent typing without creating empty source edits', () => {
    const onChange = vi.fn()
    const {container} = render(<InlineText value="Hello " onChange={onChange} />)
    const editor = container.querySelector<HTMLElement>('[contenteditable]')!
    const selection = window.getSelection()!, range = document.createRange()
    range.selectNodeContents(editor); range.collapse(false); selection.removeAllRanges(); selection.addRange(range)
    expect(applyInlineFormat('bold')).toBe(true)
    expect(onChange).not.toHaveBeenCalled()
    const type = (text:string) => {
      const caret = selection.getRangeAt(0), node = caret.startContainer as Text
      node.insertData(caret.startOffset,text); caret.setStart(node,node.length); caret.collapse(true)
      selection.removeAllRanges(); selection.addRange(caret); fireEvent.input(editor)
    }
    type('bold')
    expect(onChange).toHaveBeenLastCalledWith('Hello \\textbf{bold}')
    expect(applyInlineFormat('bold')).toBe(true)
    type(' plain')
    expect(onChange).toHaveBeenLastCalledWith('Hello \\textbf{bold} plain')
  })
  it('removes bold from a partial selection while preserving neighboring and nested formatting', () => {
    const onChange = vi.fn()
    const {container} = render(<InlineText value={'\\textbf{Alpha \\textit{beta} gamma}'} onChange={onChange} />)
    const text = container.querySelector('em')!.firstChild!
    const selection = window.getSelection()!, range = document.createRange()
    range.setStart(text,1); range.setEnd(text,3); selection.removeAllRanges(); selection.addRange(range)
    expect(applyInlineFormat('bold')).toBe(true)
    expect(onChange).toHaveBeenLastCalledWith('\\textbf{Alpha \\textit{b}}\\textit{et}\\textbf{\\textit{a} gamma}')
  })
  it('renders commands, environments and math without duplicate React keys', () => {
    const error = vi.spyOn(console,'error').mockImplementation(() => {})
    try {
      const source = '\\centering \\begin{tabular}{l} $x$ \\textbf{A} \\end{tabular}'
      const {getByTestId} = render(<LatexOutputPanel latex={source} />)
      expect(getByTestId('latex-output-line').textContent).toBe(source)
      expect(error.mock.calls.flat().join(' ')).not.toMatch(/same key|unique.*key/)
    } finally { error.mockRestore() }
  })
})
