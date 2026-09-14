import { test, expect, type Page, type APIRequestContext, type Locator } from 'playwright/test'
import { randomUUID } from 'node:crypto'
import { deflateSync } from 'node:zlib'
const API='http://127.0.0.1:8011'
const wrap=(body:string)=>`\\documentclass{article}\n\\begin{document}\n${body}\n\\end{document}\n`
async function createDocument(page:Page,request:APIRequestContext,content:string) {
  const path=`visual-${randomUUID()}.tex`
  const response=await request.post(`${API}/api/files/create`,{data:{path,type:'file',content}})
  expect(response.ok()).toBe(true)
  await page.goto('/')
  await page.getByRole('button',{name:'File',exact:true}).click()
  await page.getByRole('menuitem',{name:'Open File',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Open File'})
  await dialog.getByLabel('Search files or enter a path').fill(path)
  await dialog.getByRole('button',{name:'Open',exact:true}).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('latex-source')).toHaveValue(content)
  await page.getByTestId('visual-editor-tab').click()
  await expect(page.getByTestId('visual-document')).toBeVisible()
  await page.getByTitle('Show LaTeX alongside the visual editor').click()
  return path
}
const source=async(page:Page)=>(await page.getByTestId('latex-output-line').allTextContents()).join('\n')
async function selectWord(editor:Locator,word:string) {
  await editor.evaluate((element,word)=>{
    const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT)
    let node:Node|null
    while((node=walker.nextNode())) {
      const at=node.textContent?.indexOf(word)??-1
      if(at<0)continue
      ;(element as HTMLElement).focus()
      const range=document.createRange();range.setStart(node,at);range.setEnd(node,at+word.length)
      const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range)
      document.dispatchEvent(new Event('selectionchange'));return
    }
    throw new Error(`Missing ${word}`)
  },word)
  await expect.poll(()=>editor.evaluate(()=>window.getSelection()?.toString())).toBe(word)
}
async function build(page:Page) {
  const response=page.waitForResponse(r=>r.url()===`${API}/api/compile` && r.request().method()==='POST')
  await page.getByRole('button',{name:'Build',exact:true}).click()
  const result=await(await response).json()
  expect(result.success,JSON.stringify(result.logs)).toBe(true)
  expect(result.pdf_available).toBe(true)
}

test('continuous typing preserves macros and source through save and mode switches',async({page,request})=>{
  const original='\\documentclass{article}\n% Keep this exact preamble.\n\\newcommand{\\custom}[1]{#1}\n\\begin{document}\n\\section{Introduction}\n\nAlpha paragraph.\n\nAn \\emph{original} phrase.\n\\custom{untouched source}\n\\end{document}\n'
  const path=await createDocument(page,request,original),editor=page.getByTestId('visual-document')
  await expect(editor).toHaveCount(1)
  await selectWord(editor,'Alpha');await page.keyboard.type('Edited')
  const expected=original.replace('Alpha','Edited')
  await expect.poll(()=>source(page)).toBe(expected)
  await page.getByTestId('visual-toolbar-code-tab').click()
  await expect(page.getByTestId('latex-source')).toHaveValue(expected)
  await page.getByTestId('visual-editor-tab').click()
  await page.getByRole('button',{name:'File',exact:true}).click()
  await page.getByRole('menuitem',{name:/^Save\s*⌘S$/}).click()
  await expect.poll(async()=>(await(await request.get(`${API}/api/files/read`,{params:{path}})).json()).content).toBe(expected)
  await build(page)
})

test('typing with bold on and off retains prior formatting and allows partial removal',async({page,request})=>{
  await createDocument(page,request,wrap('Typing'))
  const editor=page.getByTestId('visual-document')
  await selectWord(editor,'Typing');await page.keyboard.press('ArrowRight')
  let builds=0;page.on('request',request=>{if(request.url()===`${API}/api/compile`)builds++})
  await page.keyboard.press('ControlOrMeta+b');await page.keyboard.type(' Bold')
  await expect.poll(()=>source(page)).toBe(wrap('Typing\\textbf{ Bold}'))
  expect(builds).toBe(0)
  await page.getByTitle('Bold (Ctrl+B)',{exact:true}).click();await page.keyboard.type(' plain')
  await expect.poll(()=>source(page)).toBe(wrap('Typing\\textbf{ Bold} plain'))
  await selectWord(editor,'old');await page.getByTitle('Bold (Ctrl+B)',{exact:true}).click()
  await expect.poll(()=>source(page)).toBe(wrap('Typing\\textbf{ B}old plain'))
  await page.getByTitle('Undo',{exact:true}).click()
  await expect.poll(()=>source(page)).toBe(wrap('Typing\\textbf{ Bold} plain'))
  await page.getByTitle('Redo',{exact:true}).click()
  await expect.poll(()=>source(page)).toBe(wrap('Typing\\textbf{ B}old plain'))
  await build(page)
})

test('selects and formats continuously across two paragraphs',async({page,request})=>{
  await createDocument(page,request,wrap('First paragraph.\n\nSecond paragraph.'))
  const editor=page.getByTestId('visual-document')
  await selectWord(editor,'First');await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('Shift+ArrowDown');await page.keyboard.press('Shift+ArrowDown');await page.keyboard.press('Shift+End')
  await page.getByTitle('Bold (Ctrl+B)',{exact:true}).click()
  await expect.poll(()=>source(page)).toContain('\\textbf{First paragraph.}\n\n\\textbf{Second paragraph.}')
  await build(page)
})

test('continues a list on Enter and exits an empty last item',async({page,request})=>{
  await createDocument(page,request,wrap('First point'))
  const editor=page.getByTestId('visual-document')
  await selectWord(editor,'First point');await page.keyboard.press('ArrowRight')
  await page.getByTitle('Bullet list',{exact:true}).click()
  await page.keyboard.press('Enter');await page.keyboard.type('Second point');await page.keyboard.press('Enter');await page.keyboard.press('Enter');await page.keyboard.type('After the list.')
  await expect.poll(()=>source(page)).toContain('\\item First point\n\\item Second point\n\\end{itemize}\nAfter the list.')
  await build(page)
})

test('edits inline math without changing neighboring text or delimiters',async({page,request})=>{
  const original=wrap('Energy $E = mc^2$ is useful.')
  await createDocument(page,request,original)
  await page.getByRole('button',{name:'Edit math',exact:true}).click()
  await page.getByRole('textbox',{name:'Equation',exact:true}).fill('x^2 + y^2')
  await page.getByRole('button',{name:'Apply',exact:true}).click()
  await expect.poll(()=>source(page)).toBe(wrap('Energy $x^2 + y^2$ is useful.'))
  await expect(page.locator('.visual-preview-math .katex')).toBeVisible()
  await build(page)
})

test('inserts a table, merges cells, reopens it and compiles',async({page,request})=>{
  await createDocument(page,request,wrap('A table follows.'))
  const editor=page.getByTestId('visual-document')
  await selectWord(editor,'A table follows.');await page.keyboard.press('ArrowRight')
  await page.getByTestId('visual-editor').getByRole('button',{name:'Insert',exact:true}).click();await page.getByRole('menuitem',{name:'Table',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Insert table'}),cells=dialog.locator('td [data-latex-editor]')
  await cells.nth(0).fill('Merged cell');await cells.nth(0).click();await cells.nth(4).click({modifiers:['Shift']})
  await dialog.getByRole('button',{name:'Merge cells',exact:true}).click()
  await dialog.getByTitle('Add row above row 2',{exact:true}).click()
  await dialog.getByRole('button',{name:'Apply',exact:true}).click()
  await expect.poll(()=>source(page)).toContain('\\multirow{3}{*}{Merged cell')
  await page.getByRole('button',{name:'Edit table',exact:true}).click()
  await expect(page.getByRole('dialog').locator('td[colspan="2"][rowspan="3"]')).toContainText('Merged cell')
  await page.getByRole('button',{name:'Cancel',exact:true}).click()
  await build(page)
})

test('imports an image asset into the project and displays its preview',async({page,request})=>{
  await createDocument(page,request,wrap('A figure follows.'))
  const editor=page.getByTestId('visual-document')
  await selectWord(editor,'A figure follows.');await page.keyboard.press('ArrowRight')
  await page.getByTestId('visual-editor').getByRole('button',{name:'Insert',exact:true}).click();await page.getByRole('menuitem',{name:'Image',exact:true}).click()
  await page.getByRole('dialog').locator('input[type="file"]').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:pngFixture()})
  await expect(page.getByRole('button',{name:'Apply',exact:true})).toBeEnabled()
  await page.getByRole('button',{name:'Apply',exact:true}).click()
  await expect.poll(()=>source(page)).toMatch(/\\includegraphics\[[^\]]+\]\{assets\/[^}]+fixture\.png\}/)
  await expect(page.locator('.visual-preview-figure img')).toBeVisible()
  const asset=(await source(page)).match(/\\includegraphics\[[^\]]+\]\{([^}]+)\}/)![1]
  const response=await request.get(`${API}/api/assets`,{params:{path:asset}})
  expect(await response.body()).toEqual(pngFixture())
  await build(page)
})
function pngFixture() {
  const crc = (buffer:Buffer) => {
    let value = 0xffffffff
    for (const byte of buffer) { value ^= byte; for (let bit=0;bit<8;bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0) }
    return (value ^ 0xffffffff) >>> 0
  }
  const chunk = (name:string,body:Buffer) => {
    const type = Buffer.from(name), size = Buffer.alloc(4), checksum = Buffer.alloc(4)
    size.writeUInt32BE(body.length); checksum.writeUInt32BE(crc(Buffer.concat([type,body])))
    return Buffer.concat([size,type,body,checksum])
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(2,0); header.writeUInt32BE(2,4); header[8]=8; header[9]=2
  const pixels = Buffer.from([0,200,80,40,200,80,40,0,200,80,40,200,80,40])
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))])
}


test('visual editing remains usable in a narrow pane',async({page,request})=>{
  await page.setViewportSize({width:390,height:844})
  await createDocument(page,request,wrap('A short mobile note.'))
  await page.getByTitle('Show LaTeX alongside the visual editor').click()
  const editor=page.getByTestId('visual-document')
  await selectWord(editor,'mobile');await page.keyboard.type('visual')
  await expect(editor).toContainText('A short visual note.')
  await build(page)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  expect(await page.locator('.visual-source-host').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(80)
  await page.getByTestId('visual-editor').getByRole('button',{name:'Insert',exact:true}).click();await page.getByRole('menuitem',{name:'Equation',exact:true}).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button',{name:'Cancel',exact:true}).click()
})
