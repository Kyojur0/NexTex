import type { VisualSpan } from './types'

/** Keep concealed syntax balanced when a visible selection crosses a formatting boundary. */
export function guardVisualChange(source:string,from:number,to:number,insert:string,spans:VisualSpan[]) {
  const preamble=spans.find(span=>span.kind==='preamble')
  const ending=spans.find(span=>span.kind==='environment' && span.value==='document')
  if(preamble)from=Math.max(from,preamble.to)
  if(ending)to=Math.min(to,ending.from)
  if(from>to)return null
  const hidden=spans.filter(span=>span.kind==='hidden')
  // Snap browser selections out of concealed command text.
  for(const span of hidden) {
    if(from>span.from && from<span.to)from=span.to
    if(to>span.from && to<span.to)to=span.from
  }
  if(from>to)return null
  const stack:VisualSpan[]=[],pairs:{open:VisualSpan;close:VisualSpan}[]=[]
  for(const span of hidden) {
    if(source.slice(span.from,span.to).endsWith('{'))stack.push(span)
    else if(source.slice(span.from,span.to)==='}') {const open=stack.pop();if(open)pairs.push({open,close:span})}
  }
  let closing='',opening=''
  for(const {open,close} of pairs) {
    if(from<=open.from && to>=close.to)continue
    if(from>=open.to && from<=close.from && to>=close.to)closing+=source.slice(close.from,close.to)
    if(from<=open.from && to>=open.to && to<=close.from)opening=source.slice(open.from,open.to)+opening
  }
  return {from,to,insert:insert+closing+opening,cursor:from+insert.length}
}
