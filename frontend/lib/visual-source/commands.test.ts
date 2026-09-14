import { describe, expect, it } from 'vitest'
import { continueList, continueVisualParagraph, formatSource, getSourceFormatting, insertSource, setHeading, toggleList } from './commands'
import type { SourceEdit, SourceSelection } from './types'

function apply(source: string, edit: SourceEdit) {
  for (const change of [...edit.changes].sort((a,b) => b.from - a.from)) source = source.slice(0,change.from) + change.insert + source.slice(change.to)
  expect(edit.selection.anchor).toBeGreaterThanOrEqual(0)
  expect(edit.selection.anchor).toBeLessThanOrEqual(source.length)
  if (edit.selection.head !== undefined) expect(edit.selection.head).toBeLessThanOrEqual(source.length)
  return source
}
const selected = (source:string,text:string):SourceSelection => ({from:source.indexOf(text),to:source.indexOf(text)+text.length})
const caret = (from:number):SourceSelection => ({from,to:from})

describe('source inline formatting', () => {
  it('wraps only selected prose and leaves the document byte-for-byte intact around it', () => {
    const source='\\documentclass{article}\r\n% retained\r\n\\begin{document}\r\nA clear idea.\r\n\\end{document}\r\n'
    const range=selected(source,'clear')
    const edit=formatSource(source,range,'bold')
    expect(apply(source,edit)).toBe(source.replace('clear','\\textbf{clear}'))
    expect(edit.selection).toEqual({anchor:range.from+8,head:range.to+8})
  })
  it('inserts an empty command at a plain caret with the caret inside', () => {
    const edit=formatSource('Hello world',caret(6),'italic')
    expect(apply('Hello world',edit)).toBe('Hello \\textit{}world')
    expect(edit.selection).toEqual({anchor:14})
  })
  it('turns off caret formatting while preserving existing formatted text', () => {
    const source='A \\textbf{bold \\textit{idea}}.'
    const edit=formatSource(source,caret(source.indexOf('bold')+2),'bold')
    expect(apply(source,edit)).toBe('A \\textbf{bo}\\textbf{ld \\textit{idea}}.')
    expect(edit.selection.anchor).toBe(13)
  })
  it('removes formatting from only the selected middle of formatted prose', () => {
    const source='A \\textbf{clear useful idea}.'
    const edit=formatSource(source,selected(source,'useful'),'bold')
    const result=apply(source,edit)
    expect(result).toBe('A \\textbf{clear }useful\\textbf{ idea}.')
    expect(result.slice(edit.selection.anchor,edit.selection.head)).toBe('useful')
  })
  it('unwraps selected command syntax and recognizes italic aliases', () => {
    const source='An \\emph{important} detail.'
    expect(apply(source,formatSource(source,selected(source,'\\emph{important}'),'italic'))).toBe('An important detail.')
  })
  it('formats paragraphs separately and preserves CRLF and blank-line whitespace', () => {
    const source='First paragraph.\r\n \r\nSecond paragraph.\r\n\r\nThird.'
    expect(apply(source,formatSource(source,{from:0,to:source.length},'underline'))).toBe('\\underline{First paragraph.}\r\n \r\n\\underline{Second paragraph.}\r\n\r\n\\underline{Third.}')
  })
  it('toggles formatting off across multiple paragraphs using the returned selection', () => {
    const source='First.\n\nSecond.'
    const added=formatSource(source,{from:0,to:source.length},'bold'), formatted=apply(source,added)
    const range={from:added.selection.anchor,to:added.selection.head!}
    expect(getSourceFormatting(formatted,range).formats.bold).toBe(true)
    expect(apply(formatted,formatSource(formatted,range,'bold'))).toBe(source)
  })
  it('keeps leading and trailing whitespace outside formatting braces', () => {
    const source='  a thought  '
    expect(apply(source,formatSource(source,{from:0,to:source.length},'strike'))).toBe('  \\sout{a thought}  ')
  })
  it.each([
    ['% do not style me\nText','style'],
    ['\\begin{verbatim}\nLiteral \\textbf{words}\n\\end{verbatim}','words'],
    ['\\verb|literal stuff|','stuff'],
    ['\\mystery[option]{untouched source}','untouched'],
    ['\\mystery\n  {untouched source}','untouched'],
    ['\\newcommand{\\thing}{unchanged}','unchanged'],
    ['\\textbf{broken','broken'],
  ])('does not mutate protected or malformed source: %s', (source,word) => {
    const edit=formatSource(source,selected(source,word),'bold')
    expect(edit.changes).toEqual([])
    expect(apply(source,edit)).toBe(source)
  })
  it('refuses a selection crossing a group boundary instead of producing invalid braces', () => {
    const source='\\textbf{some words} outside'
    expect(formatSource(source,selected(source,'words} outside'),'italic').changes).toEqual([])
  })
  it('handles escaped punctuation without treating it as a comment', () => {
    const source='Cost is 20\\% today.'
    expect(apply(source,formatSource(source,selected(source,'20\\%'),'bold'))).toBe('Cost is \\textbf{20\\%} today.')
    expect(formatSource(source,caret(source.indexOf('\\%')+1),'bold').changes).toEqual([])
  })
})

describe('source heading commands', () => {
  it('turns the current prose line into a heading without touching neighboring lines', () => {
    const source='Before\n  A new idea\nAfter'
    const edit=setHeading(source,caret(source.indexOf('new')),2)
    expect(apply(source,edit)).toBe('Before\n  \\subsection{A new idea}\nAfter')
    expect(edit.selection.anchor).toBe(source.indexOf('new')+12)
  })
  it('changes an existing heading level while preserving star, short title and inline source', () => {
    const source='\\section*[Short]{A \\textit{clear} idea}\nBody'
    expect(apply(source,setHeading(source,selected(source,'clear'),3))).toBe('\\subsubsection*[Short]{A \\textit{clear} idea}\nBody')
  })
  it('returns a heading to normal prose', () => {
    const source='Before\n\\section{A \\textbf{clear} idea}\nAfter'
    expect(apply(source,setHeading(source,selected(source,'clear'),0))).toBe('Before\nA \\textbf{clear} idea\nAfter')
  })
  it('does not convert a comment, unknown macro, or multiline selection into broken headings', () => {
    expect(setHeading('% retained',caret(4),1).changes).toEqual([])
    expect(setHeading('\\custom{Title}',caret(10),1).changes).toEqual([])
    expect(setHeading('First\n\nSecond',{from:0,to:13},1).changes).toEqual([])
    const custom='\\begin{custom}\n\\section{Keep}\n\\end{custom}'
    expect(setHeading(custom,selected(custom,'Keep'),2).changes).toEqual([])
  })
})

describe('source lists', () => {
  it('converts selected lines to a list without changing surrounding source', () => {
    const source='Before\nFirst point\nSecond point\nAfter'
    const range=selected(source,'First point\nSecond point')
    const edit=toggleList(source,range,false)
    expect(apply(source,edit)).toBe('Before\n\\begin{itemize}\n\\item First point\n\\item Second point\n\\end{itemize}\nAfter')
  })
  it('creates an empty list at a blank caret ready for typing', () => {
    const edit=toggleList('',caret(0),true)
    const result=apply('',edit)
    expect(result).toBe('\\begin{enumerate}\n\\item \n\\end{enumerate}')
    expect(edit.selection.anchor).toBe(result.indexOf('\\item ')+6)
  })
  it('keeps the caret at the same prose character when making the current line a list', () => {
    const source='First point', at=source.indexOf('point')
    const edit=toggleList(source,caret(at),false), result=apply(source,edit)
    expect(result.slice(edit.selection.anchor)).toBe('point\n\\end{itemize}')
  })
  it('toggles an existing list back into paragraphs', () => {
    const source='Before\n\\begin{itemize}\n  \\item One\n  \\item Two\n\\end{itemize}\nAfter'
    expect(apply(source,toggleList(source,caret(source.indexOf('One')),false))).toBe('Before\nOne\n\nTwo\nAfter')
  })
  it('switches list style by changing only the environment names', () => {
    const source='\\begin{itemize}\r\n  \\item One\r\n\\end{itemize}'
    const edit=toggleList(source,selected(source,'One'),true)
    expect(apply(source,edit)).toBe(source.replaceAll('itemize','enumerate'))
    expect(edit.changes).toHaveLength(2)
  })
  it('continues a list at the caret with original indentation and line endings', () => {
    const source='\\begin{itemize}\r\n  \\item One point\r\n\\end{itemize}'
    const at=source.indexOf('One point')+9
    const edit=continueList(source,caret(at))!
    expect(apply(source,edit)).toBe(source.slice(0,at)+'\r\n  \\item '+source.slice(at))
    expect(edit.selection.anchor).toBe(at+10)
  })
  it('exits a trailing empty item while retaining the completed list', () => {
    const source='\\begin{itemize}\n  \\item One\n  \\item \n\\end{itemize}'
    const edit=continueList(source,caret(source.lastIndexOf('\\item ')+6))!
    const result=apply(source,edit)
    expect(result).toBe('\\begin{itemize}\n  \\item One\n\\end{itemize}\n')
    expect(edit.selection.anchor).toBe(result.length)
  })
  it('exits an entirely empty list without leaving empty list syntax', () => {
    const source='Before\n\\begin{enumerate}\n\\item \n\\end{enumerate}\nAfter'
    const edit=continueList(source,caret(source.indexOf('\\item ')+6))!
    expect(apply(source,edit)).toBe('Before\n\nAfter')
    expect(edit.selection.anchor).toBe(7)
  })
  it('continues the innermost list without changing its parent', () => {
    const source='\\begin{itemize}\n\\item Parent\n\\begin{enumerate}\n    \\item Child\n\\end{enumerate}\n\\end{itemize}'
    const at=source.indexOf('Child')+5
    const edit=continueList(source,caret(at))!
    expect(apply(source,edit)).toBe(source.slice(0,at)+'\n    \\item '+source.slice(at))
  })
  it('ignores escaped or commented item markers, verbatim and unknown macro arguments', () => {
    for(const source of ['% \\item Fake','\\begin{verbatim}\n\\item Fake\n\\end{verbatim}','\\custom{\\item Fake}']) {
      expect(continueList(source,caret(source.indexOf('Fake')+4))).toBeNull()
      expect(toggleList(source,selected(source,'Fake'),false).changes).toEqual([])
    }
  })
  it('does not discard a custom item label on list removal', () => {
    const source='\\begin{itemize}\n\\item[Important] Keep label\n\\end{itemize}'
    expect(toggleList(source,selected(source,'Keep'),false).changes).toEqual([])
  })
  it('does not move a trailing comment across the old list boundary', () => {
    const source='\\begin{itemize}\n\\item Keep % note\n\\end{itemize} outside'
    expect(toggleList(source,selected(source,'Keep'),false).changes).toEqual([])
  })
  it('does not insert an item command inside a formatting argument', () => {
    const source='\\begin{itemize}\n\\item \\textbf{bold}\n\\end{itemize}'
    expect(continueList(source,caret(source.indexOf('bold')+2))).toBeNull()
  })
  it('does not discard an empty item with an explicit label', () => {
    const source='\\begin{itemize}\n\\item[Note] \n\\end{itemize}'
    expect(continueList(source,caret(source.indexOf('[Note]')+7))).toBeNull()
  })
})

describe('insertion and toolbar state', () => {
  it('replaces the exact captured source selection with the supplied LaTeX', () => {
    const source='Before SELECT After'
    const edit=insertSource(source,selected(source,'SELECT'),'\\cite{key}')
    expect(apply(source,edit)).toBe('Before \\cite{key} After')
    expect(edit.selection).toEqual({anchor:17})
  })
  it('reports nested formats, heading and list state using original source offsets', () => {
    const source='\\begin{enumerate}\n\\item \\subsection{A \\textbf{\\emph{clear}} idea}\n\\end{enumerate}'
    expect(getSourceFormatting(source,selected(source,'clear'))).toEqual({formats:{bold:true,italic:true,underline:false,strike:false},heading:2,list:'ordered'})
  })
})

describe('visual paragraph continuation',()=>{
  it('leaves a heading and keeps the following text as prose',()=>{
    const source='\\section{Heading continues}\nNext.'
    const at=source.indexOf(' continues'),edit=continueVisualParagraph(source,caret(at))!
    expect(apply(source,edit)).toBe('\\section{Heading}\n\n continues\nNext.')
  })
  it('splits nested formatting into valid separate paragraphs',()=>{
    const source='\\textbf{bold \\emph{one two}}'
    const at=source.indexOf(' two'),edit=continueVisualParagraph(source,caret(at))!
    expect(apply(source,edit)).toBe('\\textbf{bold \\emph{one}}\n\n\\textbf{\\emph{ two}}')
  })
})
