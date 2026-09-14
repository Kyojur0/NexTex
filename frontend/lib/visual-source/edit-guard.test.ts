import {describe,expect,it} from 'vitest'
import {scanVisualSource} from './scanner'
import {guardVisualChange} from './edit-guard'
function replace(source:string,from:number,to:number,insert='') {const edit=guardVisualChange(source,from,to,insert,scanVisualSource(source));return edit?source.slice(0,edit.from)+edit.insert+source.slice(edit.to):source}
describe('visible selection guards',()=>{
  it('keeps the surviving left fragment formatted',()=>{const source='A \\textbf{bold phrase} and plain.';expect(replace(source,source.indexOf('phrase'),source.indexOf('plain'),'new ')).toBe('A \\textbf{bold new }plain.')})
  it('keeps the surviving right fragment formatted',()=>{const source='A plain \\textbf{bold phrase}.';expect(replace(source,2,source.indexOf('phrase'),'new ')).toBe('A new \\textbf{phrase}.')})
  it('retains nested wrappers across a deletion boundary',()=>{const source='\\textbf{bold \\textit{italic words}} after.';expect(replace(source,source.indexOf('words'),source.indexOf('after'),'new')).toBe('\\textbf{bold \\textit{italic new}}after.')})
  it('deletes completely selected formatting without leaving empty braces',()=>{const source='A \\textbf{bold} plain.';expect(replace(source,2,source.indexOf(' plain'))).toBe('A  plain.')})
  it('preserves a full document wrapper when replacing all visible text',()=>{const source='\\documentclass{article}\n\\begin{document}\nHello.\n\\end{document}';expect(replace(source,0,source.length,'Changed.')).toBe('\\documentclass{article}\n\\begin{document}Changed.\\end{document}')})
})
