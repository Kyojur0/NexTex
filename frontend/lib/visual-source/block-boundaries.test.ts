import { describe, expect, it } from 'vitest'
import { scanVisualSource } from './scanner'
import { getVisualBlockStarts } from './block-boundaries'

const starts = (source:string) => getVisualBlockStarts(source,scanVisualSource(source))

describe('visual content block separators', () => {
  it('separates paragraphs while leaving source-continuation lines together', () => {
    const source = 'First line\ncontinued here\n\n  Second paragraph\nstill the same\n\nThird'
    expect(starts(source)).toEqual([source.indexOf('  Second'),source.indexOf('Third')])
  })
  it('separates adjacent prose, display math, a whole nested list, a table and following prose', () => {
    const equation = '\\begin{equation}\nx=1\n\\end{equation}'
    const list = '\\begin{itemize}\n\\item One\n\n\\item Two\n\\begin{enumerate}\n\\item Nested\n\\end{enumerate}\n\\end{itemize}'
    const table = '\\begin{table}\n\\begin{tabular}{lr}\nA & B \\\\\n\\end{tabular}\n\\end{table}'
    const source = `Prose\n${equation}\nAfter math\n${list}\n${table}\nFinal prose`
    expect(starts(source)).toEqual([source.indexOf(equation),source.indexOf('After math'),source.indexOf(list),source.indexOf(table),source.indexOf('Final prose')])
  })
  it('does not count a preamble or trailing document boundary as content', () => {
    const source = '\\documentclass{article}\n\n% preamble comment\n\\begin{document}\n\nFirst\n\nSecond\n\n\\end{document}\n'
    expect(starts(source)).toEqual([source.indexOf('Second')])
  })
  it('does not create dividers for comment-only gaps or put them on comments', () => {
    const source = 'First\n% comment\n% another\nContinuation\n\n% explanation\n\nSecond'
    expect(starts(source)).toEqual([source.indexOf('Second')])
  })
  it('treats escaped percent as paragraph content and preserves CRLF line offsets', () => {
    const source = '% intro\r\n\\% first\r\ncontinued\r\n\r\n  Second\r\n'
    expect(starts(source)).toEqual([source.indexOf('  Second')])
  })
  it('keeps heading and immediately following prose together, allowing a later paragraph split', () => {
    const source = 'Introduction\n\\section{Heading}\nAttached prose\n\nNext paragraph\n\\subsection{Next heading}\nMore attached prose'
    expect(starts(source)).toEqual([source.indexOf('\\section'),source.indexOf('Next paragraph'),source.indexOf('\\subsection')])
  })
  it('counts title as the first content block and does not divide its immediate prose', () => {
    const source = '\\title{A title}\n\\begin{document}\n\\maketitle\nAttached\n\nParagraph\n\\end{document}'
    expect(starts(source)).toEqual([source.indexOf('Paragraph')])
  })
  it('separates single-line display math and figure widgets, leaving inline math in prose', () => {
    const figure = '\\begin{figure}\\includegraphics{a.png}\\end{figure}'
    const source = `First $inline$\ncontinued \\(x\\)\n\\[display\\]\nAfter\n${figure}\nEnd`
    expect(starts(source)).toEqual([source.indexOf('\\[display'),source.indexOf('After'),source.indexOf(figure),source.indexOf('End')])
  })
  it('does not split opaque environments, unsupported lists, or multiline widget interiors', () => {
    const source = 'First\n\n\\begin{custom}\nInside\n\nStill inside\n\\end{custom}\n\nNext\n\\begin{enumerate}[start=4]\n\\item One\n\n\\item Two\n\\end{enumerate}\n\nLast'
    expect(starts(source)).toEqual([source.indexOf('\\begin{custom}'),source.indexOf('Next'),source.indexOf('Last')])
  })
  it('never emits a separator inside a multiline replacement even with blank lines', () => {
    const source = 'First\n\n$math\n\ncontinued$\nFollowing\n\nLast'
    expect(starts(source)).toEqual([source.indexOf('$math'),source.indexOf('Last')])
  })
  it('returns line starts before indented widgets and never starts a list item block', () => {
    const source = '\\begin{itemize}\n\\item First\n\\item Second\n\\end{itemize}\n  \\[x\\]\nTail'
    expect(starts(source)).toEqual([source.indexOf('  \\['),source.indexOf('Tail')])
  })
  it('does not mutate caller spans or source', () => {
    const source = 'One\n\nTwo', spans = scanVisualSource(source)
    const snapshot = structuredClone(spans)
    Object.freeze(spans)
    expect(getVisualBlockStarts(source,spans)).toEqual([5])
    expect(spans).toEqual(snapshot)
  })
})
