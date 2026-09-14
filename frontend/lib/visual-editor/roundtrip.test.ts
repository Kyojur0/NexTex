import { describe, expect, it } from 'vitest'
import { parseLaTeXToBlocks } from './parser'
import { blocksToLaTeX } from './serializer'
import { tablePlugin } from './plugins/table'

describe('visual source fidelity', () => {
  const documents = [
    '\\documentclass{article}\n\\usepackage{amsmath}\n\n\\begin{document}\n\\section{A \\textbf{nested} title}\n\nHello \\textit{world}.\n\\end{document}\n',
    '% a comment with \\begin{document}\r\n\\begin{custom}[option]{argument}\r\n  nested {content}\r\n\\end{custom}\r\n',
    '\\begin{itemize}[nosep]\n\\item First\ncontinued\n\\begin{enumerate}\n\\item Nested\n\\end{enumerate}\n\\item Last\n\\end{itemize}\n',
    '\\begin{table}\n\\begin{tabular}{lcr}\na & & c \\\\\n\\multicolumn{2}{l}{hello} & last \\\\\n\\end{tabular}\n\\caption{A {nested} caption}\n\\end{table}\n',
    '\\begin{verbatim}\n\\end{document}\n\\begin{anything}\n\\end{verbatim}\n',
    '\\begin{mystery}[a]\nunterminated',
    '\\section*{Starred}\\label{a}\n\\newcommand{\\x}[1]{#1}\n  trailing spaces  \n\n',
  ]
  it.each(documents)('preserves complete source byte for byte %#', (source) => {
    expect(blocksToLaTeX(parseLaTeXToBlocks(source))).toBe(source)
  })
  it('edits a paragraph without changing surrounding source', () => {
    const source = '\\documentclass{article}\n\\begin{document}\n\nHello world.\n\n\\begin{custom}[x]\n untouched\n\\end{custom}\n\\end{document}\n'
    const blocks = parseLaTeXToBlocks(source)
    const paragraph = blocks.find(block => block.type === 'paragraph' && (block.data as {text:string}).text === 'Hello world.')!
    expect(paragraph).toBeDefined()
    paragraph.data = {text: 'Hello edited world.'}
    expect(blocksToLaTeX(blocks)).toBe(source.replace('Hello world.', 'Hello edited world.'))
  })
  it('uses editable raw blocks for unsupported nested environments', () => {
    const source = '\\begin{custom}[x]\n\\begin{custom}\na\n\\end{custom}\n\\end{custom}'
    const blocks = parseLaTeXToBlocks(source)
    expect(blocks[0].type).toBe('raw')
    expect(blocksToLaTeX(blocks)).toBe(source)
  })
  it('retains paragraph boundaries after reordering parsed blocks', () => {
    const blocks = parseLaTeXToBlocks('First.\n\nSecond.')
    expect(blocksToLaTeX([blocks[1],blocks[0]])).toContain('Second.\n\nFirst.')
  })
  it('keeps code indentation when changing the listing language', () => {
    const blocks = parseLaTeXToBlocks('\\begin{lstlisting}[language=python]\n    nested_call()\n        continuation()\n\\end{lstlisting}')
    blocks[0].data = {...(blocks[0].data as object),language:'ruby'}
    expect(blocksToLaTeX(blocks)).toContain('\n    nested_call()\n        continuation()\n')
  })
  it('keeps imported multicolumn alignment when another table property changes', () => {
    const blocks = parseLaTeXToBlocks('\\begin{table}\n\\begin{tabular}{l|l}\n\\multicolumn{2}{c}{Centered} \\\\\n\\end{tabular}\n\\caption{Before}\n\\end{table}')
    expect(blocks[0].type).toBe('table')
    blocks[0].data = {...(blocks[0].data as object),caption:'After'}
    expect(blocksToLaTeX(blocks)).toContain('\\multicolumn{2}{c}{Centered}')
  })
  it('does not resize an existing figure when its caption is edited', () => {
    const blocks = parseLaTeXToBlocks('\\begin{figure}\n\\includegraphics{image.png}\n\\caption{Before}\n\\end{figure}')
    expect(blocks[0].type).toBe('figure')
    blocks[0].data = {...(blocks[0].data as object),caption:'After'}
    expect(blocksToLaTeX(blocks)).toContain('\\includegraphics{image.png}')
    expect(blocksToLaTeX(blocks)).not.toContain('\\centering')
  })
  it('emits logical columns and rowspan placeholders for merged tables', () => {
    const latex = tablePlugin.toLaTeX({caption:'', rows:[
      [{content:'A',colspan:2,rowspan:2},{content:'',colspan:1,rowspan:1,hidden:true},{content:'B',colspan:1,rowspan:1}],
      [{content:'',colspan:1,rowspan:1,hidden:true},{content:'',colspan:1,rowspan:1,hidden:true},{content:'C',colspan:1,rowspan:1}],
    ]})
    expect(latex).toContain('\\begin{tabular}{l|l|l}')
    expect(latex).toContain('\\multicolumn{2}{l}{\\multirow{2}{*}{A}} & B')
    expect(latex).toContain(' &  & C')
    const parsed = parseLaTeXToBlocks(latex)
    expect(parsed[0].type).toBe('table')
    expect((parsed[0].data as {rows: unknown[][]}).rows).toHaveLength(2)
    expect(blocksToLaTeX(parsed)).toBe(latex)
  })
})
