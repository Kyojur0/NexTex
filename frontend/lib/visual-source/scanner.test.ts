import { describe, expect, it } from 'vitest'
import { scanVisualSource } from './scanner'
import type { VisualSpan } from './types'

const lexemes = (source:string, kind:VisualSpan['kind']) => scanVisualSource(source).filter(span => span.kind === kind).map(span => source.slice(span.from,span.to))
const replacements = new Set<VisualSpan['kind']>(['hidden','math','reference','preamble','figure','table','list-marker','environment','title'])

describe('source-backed visual scanner', () => {
  it('marks exact nested argument ranges without rewriting text or surrounding spaces', () => {
    const source = 'Before \\textbf{bold \\textit{italic} tail} after'
    expect(lexemes(source,'bold')).toEqual(['bold \\textit{italic} tail'])
    expect(lexemes(source,'italic')).toEqual(['italic'])
    expect(lexemes(source,'hidden')).toEqual(['\\textbf{','\\textit{','}','}'])
  })
  it('supports heading levels, stars and optional source without hiding the short title', () => {
    const source = '\\section*{Introduction}\n\\subsection[Short]{Long title}'
    expect(scanVisualSource(source).filter(span => span.kind === 'heading').map(span => [source.slice(span.from,span.to),span.level])).toEqual([['Introduction',1]])
    expect(lexemes(source,'code')).toEqual(['\\subsection[Short]{Long title}'])
  })
  it('does not interpret comments, escaped commands, verbatim or literal dollar signs', () => {
    const source = '% \\textbf{comment}\r\n\\\\textbf{literal} \\% \\$5 \\verb|\\textbf{x} $x$|\n\\begin{verbatim}\n\\end{document}\n\\textit{x}\n\\end{verbatim}\n\\underline{real}'
    expect(lexemes(source,'bold')).toEqual([])
    expect(lexemes(source,'italic')).toEqual([])
    expect(lexemes(source,'math')).toEqual([])
    expect(lexemes(source,'comment')).toEqual(['% \\textbf{comment}'])
    expect(lexemes(source,'underline')).toEqual(['real'])
    expect(lexemes(source,'code')).toContain('\\verb|\\textbf{x} $x$|')
  })
  it('handles escaped braces and commented braces in a formatting argument', () => {
    const source = '\\textbf{A \\{literal\\} % } ignored\nB}'
    expect(lexemes(source,'bold')).toEqual(['A \\{literal\\} % } ignored\nB'])
    expect(lexemes(source,'comment')).toEqual(['% } ignored'])
  })
  it.each(['\\textbf{unclosed \\textit{nested}', '\\unknown{\\textbf{hidden}}', '\\begin{custom}\n\\textbf{hidden}\n\\end{custom}', '\\begin{itemize}\n\\item x\n\\end{enumerate}'])('leaves malformed or unknown constructs visible: %s', source => {
    expect(scanVisualSource(source).filter(span => replacements.has(span.kind))).toEqual([])
  })
  it('does not collapse a fake document marker inside macro arguments', () => {
    const source = '\\documentclass{article}\n\\newcommand{\\fake}{\\begin{document}}\n% \\begin{document}\n\\begin{document}\nBody\n\\end{document}\nTrailing'
    const spans = scanVisualSource(source)
    expect(spans.filter(span => span.kind === 'preamble')).toEqual([{kind:'preamble',from:0,to:source.indexOf('\nBody'),value:source.slice(0,source.indexOf('\nBody')),block:true}])
    expect(lexemes(source,'environment')).toEqual(['\\end{document}'])
    expect(spans.some(span => span.from <= source.indexOf('Body') && span.to > source.indexOf('Body'))).toBe(false)
  })
  it('leaves an incomplete document visibly editable', () => {
    const source = '\\documentclass{article}\n\\begin{document}\n\\textbf{body}'
    expect(scanVisualSource(source).filter(span => replacements.has(span.kind))).toEqual([])
  })
  it('returns exact inline and display math content ranges with escaped delimiters', () => {
    const source = 'Price \\$5; $a+\\$b$ and \\(x^2\\).\n\\[\ny = 2\n\\]\n$$z$$'
    const spans = scanVisualSource(source).filter(span => span.kind === 'math')
    expect(spans.map(span => [source.slice(span.from,span.to),source.slice(span.contentFrom!,span.contentTo!),span.block])).toEqual([
      ['$a+\\$b$','a+\\$b',false],['\\(x^2\\)','x^2',false],['\\[\ny = 2\n\\]','\ny = 2\n',true],['$$z$$','z',false],
    ])
  })
  it('ignores math closers inside comments and does not hide unmatched delimiters', () => {
    const source = '$x % $ is a comment\n+y$\n\\[unfinished'
    expect(lexemes(source,'math')).toEqual(['$x % $ is a comment\n+y$'])
    expect(lexemes(source,'code')).toContain('\\[unfinished')
  })
  it('recognizes citations with balanced optional arguments and reference keys', () => {
    const source = 'See \\citep[see {p. 1}][chap. 2]{smith,jones} and \\eqref{eq:a}; \\cite{unfinished'
    const references = scanVisualSource(source).filter(span => span.kind === 'reference')
    expect(references.map(span => [source.slice(span.from,span.to),span.value,source.slice(span.contentFrom!,span.contentTo!)])).toEqual([
      ['\\citep[see {p. 1}][chap. 2]{smith,jones}','smith,jones','smith,jones'],['\\eqref{eq:a}','eq:a','eq:a'],
    ])
  })
  it('tracks nested ordered and unordered list markers without hiding item contents', () => {
    const source = '\\begin{enumerate}\n\\item First\n\\begin{itemize}\n\\item Nested\n\\end{itemize}\n\\item Second\n\\end{enumerate}'
    expect(scanVisualSource(source).filter(span => span.kind === 'list-marker').map(span => [source.slice(span.from,span.to),span.value,span.level])).toEqual([
      ['\\item','1.',1],['\\item','•',2],['\\item','2.',1],
    ])
    expect(lexemes(source,'environment')).toHaveLength(4)
  })
  it('keeps list options visible when their numbering or label semantics are unsupported', () => {
    const source = '\\begin{enumerate}[start=4]\n\\item Fourth\n\\end{enumerate}'
    expect(scanVisualSource(source).filter(span => replacements.has(span.kind))).toEqual([])
  })
  it('recognizes a simple figure and exposes its body while preserving full widget source', () => {
    const source = '\\begin{figure}[ht]\n\\centering\n\\includegraphics[width=0.5\\textwidth]{assets/photo.png}\n\\caption{A \\textbf{caption}}\n\\label{fig:a}\n\\end{figure}'
    const spans = scanVisualSource(source)
    expect(spans).toHaveLength(1)
    expect(spans[0]).toMatchObject({kind:'figure',from:0,to:source.length,value:source,block:true})
    expect(source.slice(spans[0].contentFrom!,spans[0].contentTo!)).toContain('\\includegraphics')
  })
  it.each([
    '\\begin{figure}\n\\includegraphics{a.png}\n\\unknown{important}\n\\end{figure}',
    '\\begin{table}\n\\begin{tabular}{p{3cm}r}\nA & B \\\\\n\\end{tabular}\n\\end{table}',
  ])('keeps unsupported figure and table contents visible', source => {
    expect(scanVisualSource(source).filter(span => replacements.has(span.kind))).toEqual([])
  })
  it('recognizes simple standalone tabular and table wrappers with correct boundaries', () => {
    const source = 'Before\n\\begin{table}[h]\n\\begin{tabular}{l|r}\nA & B \\\\\nC & D \\\\\n\\end{tabular}\n\\caption{Values}\n\\end{table}\nAfter'
    expect(lexemes(source,'table')).toEqual([source.slice(source.indexOf('\\begin{table}'),source.indexOf('\nAfter'))])
    const inline = '\\begin{tabular}{lr} A & B \\\\ \\end{tabular}'
    expect(scanVisualSource(inline)[0]).toMatchObject({kind:'table',block:false})
  })
  it('recognizes equation environments and a title command outside the preamble', () => {
    const source = '\\title{My title}\n\\begin{document}\n\\maketitle\n\\begin{equation}\nx^2\n\\end{equation}\n\\end{document}'
    expect(scanVisualSource(source).find(span => span.kind === 'title')).toMatchObject({value:'My title'})
    expect(scanVisualSource(source).find(span => span.kind === 'math')).toMatchObject({value:'\nx^2\n',block:true})
  })
  it('never produces invalid or intersecting replacement ranges for mixed source', () => {
    const source = '\\section{A \\textbf{title}}\nText $x$ \\cite{a}.\n\\unknown{\\begin{figure}\\end{figure}}\n\\begin{itemize}\n\\item \\textit{item}\n\\end{itemize}'
    const spans = scanVisualSource(source)
    for (const span of spans) {
      expect(span.from).toBeGreaterThanOrEqual(0); expect(span.to).toBeGreaterThan(span.from); expect(span.to).toBeLessThanOrEqual(source.length)
      if (span.contentFrom !== undefined) { expect(span.contentFrom).toBeGreaterThanOrEqual(span.from); expect(span.contentTo!).toBeLessThanOrEqual(span.to) }
    }
    const atoms = spans.filter(span => replacements.has(span.kind))
    for (let i=1;i<atoms.length;i++) expect(atoms[i].from).toBeGreaterThanOrEqual(atoms[i-1].to)
  })
  it.each([
    '\\begin{itemize}[unfinished\n\\item visible\n\\end{itemize}',
    '\\begin{figure}[unfinished\n\\includegraphics{a.png}\n\\end{figure}',
    '\\begin{tabular}{lr} & & \\end{tabular}',
  ])('does not conceal malformed options or table rows', source => {
    expect(scanVisualSource(source).filter(span => replacements.has(span.kind))).toEqual([])
  })
  it('does not overflow when formatting is deeply nested', () => {
    const source = '\\textbf{'.repeat(10000) + 'text' + '}'.repeat(10000)
    expect(() => scanVisualSource(source)).not.toThrow()
    expect(scanVisualSource(source).some(span => span.kind === 'code')).toBe(true)
  })
})
