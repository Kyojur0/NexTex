import { test, expect, type Page, type APIRequestContext, type Locator } from 'playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { deflateSync } from 'node:zlib'

const API = 'http://127.0.0.1:8011'
const wrap = (body: string) => `\\documentclass{article}\n\\begin{document}\n${body}\n\\end{document}\n`

async function openFile(page: Page, path: string) {
  await page.getByRole('button',{name:'File',exact:true}).click()
  await page.getByRole('menuitem',{name:'Open File',exact:true}).click()
  const dialog = page.getByRole('dialog',{name:'Open File'})
  await dialog.getByLabel('Search files or enter a path').fill(path)
  await dialog.getByRole('button',{name:'Open',exact:true}).click()
  await expect(dialog).toBeHidden()
}
async function createDocument(page: Page, request: APIRequestContext, content: string) {
  const path = `visual-${randomUUID()}.tex`
  const created = await request.post(`${API}/api/files/create`,{data:{path,type:'file',content}})
  expect(created.ok(),await created.text()).toBeTruthy()
  await page.goto('/')
  await expect(page.getByRole('button',{name:'File',exact:true})).toBeVisible()
  await openFile(page,path)
  if (await page.getByTestId('visual-toolbar-code-tab').count()) await page.getByTestId('visual-toolbar-code-tab').click()
  await expect(page.getByTestId('latex-source')).toHaveValue(content)
  await page.getByTestId('visual-editor-tab').click()
  await expect(page.getByTestId('block-canvas')).toBeVisible()
  return path
}
async function visualSource(page: Page) {
  return (await page.getByTestId('latex-output-line').allTextContents()).join('\n')
}
async function addBlock(page: Page, type: string) {
  await page.getByTestId('insert-menu-button').click()
  await page.getByTestId(`insert-menu-${type}`).click()
}
async function selectWord(editor: Locator, word: string) {
  await editor.evaluate((element, selectedWord) => {
    const walker = document.createTreeWalker(element,NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const at = node.textContent?.indexOf(selectedWord) ?? -1
      if (at < 0) continue
      ;(element as HTMLElement).focus()
      const range = document.createRange(); range.setStart(node,at); range.setEnd(node,at + selectedWord.length)
      const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
      return
    }
    throw new Error(`Could not select ${selectedWord}`)
  },word)
}
async function save(page: Page, request: APIRequestContext, path: string) {
  const expected = await visualSource(page)
  await page.getByRole('button',{name:'File',exact:true}).click()
  await page.getByRole('menuitem',{name:/^Save\s*⌘S$/}).click()
  await expect.poll(async () => (await (await request.get(`${API}/api/files/read`,{params:{path}})).json()).content).toBe(expected)
  return expected
}
async function buildPdf(page: Page, request: APIRequestContext) {
  const response = page.waitForResponse(response => response.url() === `${API}/api/compile` && response.request().method() === 'POST')
  await page.getByRole('button',{name:'Build',exact:true}).click()
  const result = await (await response).json()
  expect(result.success,JSON.stringify(result.logs)).toBe(true)
  expect(result.pdf_available).toBe(true)
  const pdf = await request.get(new URL(result.pdf_url,API).toString())
  expect(pdf.ok()).toBe(true)
  expect((await pdf.body()).subarray(0,5).toString()).toBe('%PDF-')
}
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

test.describe('Visual editor document integrity', () => {
  test('preserves full document wrappers and unsupported nested source while editing and reloading', async ({page,request}) => {
    const original = '\\documentclass{article}\n% Preserve this preamble exactly.\n\\newenvironment{custom}[1][]{\\begin{quote}}{\\end{quote}}\n\\begin{document}\n\\section{Original heading}\n\nAlpha paragraph.\n\n\\begin{custom}[option]\nUnchanged {grouped} source.\n\\begin{itemize}\n\\item Outer\n\\begin{enumerate}\n\\item Inner\n\\end{enumerate}\n\\end{itemize}\n\\end{custom}\n\\end{document}\n'
    const path = await createDocument(page,request,original)
    expect(await visualSource(page)).toBe(original)
    await page.getByRole('textbox',{name:'Section title',exact:true}).fill('Edited heading')
    await page.locator('[data-latex-editor]').filter({hasText:'Alpha paragraph.'}).fill('Edited paragraph.')
    const expected = original.replace('Original heading','Edited heading').replace('Alpha paragraph.','Edited paragraph.')
    await expect.poll(() => visualSource(page)).toBe(expected)
    await save(page,request,path)
    await page.getByTestId('visual-toolbar-code-tab').click()
    await expect(page.getByTestId('latex-source')).toHaveValue(expected)
    await page.getByTestId('visual-editor-tab').click()
    expect(await visualSource(page)).toBe(expected)
    await page.reload()
    await openFile(page,path)
    if (await page.getByTestId('visual-toolbar-code-tab').count()) await page.getByTestId('visual-toolbar-code-tab').click()
    await expect(page.getByTestId('latex-source')).toHaveValue(expected)
  })

  test('saves bold, subscript, superscript, link and other inline formatting across modes', async ({page,request}) => {
    await createDocument(page,request,wrap('Bold Super Sub Link Strike Code Under Italic.'))
    const editor = page.locator('[data-latex-editor]').first()
    for (const [word,title,command] of [
      ['Bold','Bold (Ctrl+B)','textbf'],['Super','Superscript','textsuperscript'],['Sub','Subscript','textsubscript'],
      ['Strike','Strikethrough','sout'],['Code','Inline code','texttt'],['Under','Underline (Ctrl+U)','underline'],['Italic','Italic (Ctrl+I)','textit'],
    ]) {
      await selectWord(editor,word)
      await page.getByTitle(title,{exact:true}).click()
      await expect.poll(() => visualSource(page)).toContain(`\\${command}{${word}}`)
    }
    await selectWord(editor,'Link')
    page.once('dialog',dialog => dialog.accept('https://example.org/#section'))
    await page.getByTitle('Link',{exact:true}).click()
    const source = await visualSource(page)
    expect(source).toContain('\\href{https://example.org/\\#section}{Link}')
    expect(source).toContain('\\usepackage[normalem]{ulem}')
    expect(source).toContain('\\usepackage{hyperref}')
    await page.getByTestId('visual-toolbar-code-tab').click()
    await expect(page.getByTestId('latex-source')).toHaveValue(source)
    await page.getByTestId('visual-editor-tab').click()
    await expect(editor.locator('strong')).toHaveText('Bold')
    await expect(editor.locator('sup')).toHaveText('Super')
    await expect(editor.locator('sub')).toHaveText('Sub')
    await expect(editor.locator('a')).toHaveAttribute('href','https://example.org/#section')
    await buildPdf(page,request)
  })

  test('edits and merges a table, preserves it across modes and builds a PDF', async ({page,request}) => {
    await createDocument(page,request,wrap('A table follows.'))
    await addBlock(page,'table')
    const cells = page.locator('[data-testid="block-canvas"] td [data-latex-editor]')
    await cells.nth(0).fill('Merged cell')
    await cells.nth(0).click()
    await cells.nth(4).click({modifiers:['Shift']})
    await page.getByRole('button',{name:'Merge cells',exact:true}).click()
    await expect.poll(() => visualSource(page)).toContain('\\multicolumn{2}{l}{\\multirow{2}{*}{Merged cell')
    await page.getByTitle('Add row above row 2',{exact:true}).click()
    await expect.poll(() => visualSource(page)).toContain('\\multirow{3}{*}')
    const source = await visualSource(page)
    expect(source).toContain('\\begin{tabular}{l|l|l}')
    expect(source).toContain('\\usepackage{multirow}')
    await page.getByTestId('visual-toolbar-code-tab').click()
    await expect(page.getByTestId('latex-source')).toHaveValue(source)
    await page.getByTestId('visual-editor-tab').click()
    const merged = page.locator('td[colspan="2"][rowspan="3"]')
    await expect(merged).toHaveCount(1)
    await expect(merged).toContainText('Merged cell')
    await buildPdf(page,request)
  })

  test('imports an actual image asset, verifies stored bytes and compiles it', async ({page,request}) => {
    const path = await createDocument(page,request,wrap('An imported figure follows.'))
    await addBlock(page,'figure')
    await page.locator('input[type="file"]').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:pngFixture()})
    await expect.poll(() => visualSource(page)).toMatch(/\\includegraphics\[[^\]]+\]\{assets\/[^}]+fixture\.png\}/)
    const source = await save(page,request,path)
    const asset = source.match(/\\includegraphics\[[^\]]+\]\{([^}]+)\}/)![1]
    const response = await request.get(`${API}/api/assets`,{params:{path:asset}})
    expect(response.ok()).toBe(true)
    expect(response.headers()['content-type']).toContain('image/png')
    expect(await response.body()).toEqual(readFileSync(join(process.env.NEXTEX_E2E_WORKSPACE!,asset)))
    await expect(page.locator('img[alt="Figure caption"]')).toBeVisible()
    expect(source).toContain('\\usepackage{graphicx}')
    await buildPdf(page,request)
    await page.getByTestId('visual-toolbar-code-tab').click()
    await page.getByTestId('visual-editor-tab').click()
    await expect(page.locator('img[alt="Figure caption"]')).toBeVisible()
  })

  test('actually reorders blocks with the keyboard and restores exact source with undo/redo', async ({page,request}) => {
    const original = wrap('First paragraph.\n\nSecond paragraph.')
    await createDocument(page,request,original)
    const first = page.getByTestId('block-card').filter({has:page.locator('[data-latex-editor]',{hasText:'First paragraph.'})})
    const handle = first.getByRole('button',{name:'Drag to reorder'})
    const second = page.getByTestId('block-card').filter({has:page.locator('[data-latex-editor]',{hasText:'Second paragraph.'})})
    const firstId = await first.getAttribute('data-block-id')
    const secondId = await second.getAttribute('data-block-id')
    await handle.focus(); await handle.press('Space')
    await expect(handle).toHaveAttribute('aria-pressed', 'true')
    const dragStatus = page.getByRole('status').filter({hasText:'was moved over droppable area'})
    await expect(dragStatus).toContainText(`droppable area ${firstId}`)
    await handle.press('ArrowDown')
    await expect(dragStatus).toContainText(`droppable area ${secondId}`)
    await handle.press('Space')
    await expect.poll(async () => {
      const source = await visualSource(page)
      return source.indexOf('Second paragraph.') < source.indexOf('First paragraph.')
    }).toBe(true)
    const moved = await visualSource(page)
    await page.getByTitle('Undo',{exact:true}).click()
    await expect.poll(() => visualSource(page)).toBe(original)
    await page.getByTitle('Redo',{exact:true}).click()
    await expect.poll(() => visualSource(page)).toBe(moved)
    await page.getByTestId('visual-toolbar-code-tab').click()
    await page.getByTestId('visual-editor-tab').click()
    await page.getByTitle('Undo',{exact:true}).click()
    await expect.poll(() => visualSource(page)).toBe(original)
    await page.getByTitle('Redo',{exact:true}).click()
    await expect.poll(() => visualSource(page)).toBe(moved)
    await first.locator('[data-latex-editor]').click()
    await first.getByTitle('Delete',{exact:true}).click()
    await expect.poll(() => visualSource(page)).not.toContain('First paragraph.')
    await page.getByTitle('Undo',{exact:true}).click()
    await expect.poll(() => visualSource(page)).toBe(moved)
  })

  test('types at a formatted caret, turns formatting off and removes it from part of a word', async ({page,request}) => {
    await createDocument(page,request,wrap('Typing'))
    const editor = page.locator('[data-latex-editor]').first()
    await editor.click(); await editor.press('End')
    await page.getByTitle('Bold (Ctrl+B)',{exact:true}).click()
    await page.keyboard.type(' Bold')
    await expect.poll(() => visualSource(page)).toContain('Typing\\textbf{ Bold}')
    await page.getByTitle('Bold (Ctrl+B)',{exact:true}).click()
    await page.keyboard.type(' plain')
    await expect.poll(() => visualSource(page)).toContain('Typing\\textbf{ Bold} plain')
    await selectWord(editor,'old')
    await page.getByTitle('Bold (Ctrl+B)',{exact:true}).click()
    await expect.poll(() => visualSource(page)).toContain('Typing\\textbf{ B}old plain')
    const source = await visualSource(page)
    expect(source).not.toContain('\u200b')
    await page.getByTestId('visual-toolbar-code-tab').click()
    await expect(page.getByTestId('latex-source')).toHaveValue(source)
    await page.getByTestId('visual-editor-tab').click()
    await expect(editor.locator('strong')).toHaveText(' B')
  })
})
