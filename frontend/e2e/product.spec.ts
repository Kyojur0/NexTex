import { test, expect, type Page, type APIRequestContext } from 'playwright/test'
import { readFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const backend = 'http://127.0.0.1:8011'
const original = '\\documentclass{article}\n\\begin{document}\n\\section{Introduction}\nHello world.\n\\end{document}\n'
const disk = (path: string) => readFileSync(join(process.env.NEXTEX_E2E_WORKSPACE!, path), 'utf8')
async function menu(page: Page, label: string) {
  await page.getByRole('button', { name: 'File', exact: true }).click()
  await page.getByRole('menuitem', { name: label, exact: false }).click()
}
async function open(page: Page, request: APIRequestContext, name: string, content = original) {
  const response = await request.post(`${backend}/api/files/create`, { data: { path: name, type: 'file', content } })
  expect(response.ok()).toBeTruthy()
  await page.goto('/')
  await expect(page.getByTestId('latex-source')).toBeVisible()
  await menu(page, 'Open File')
  await page.getByRole('dialog').getByRole('button', { name, exact: true }).click()
  await expect(page.getByTestId('latex-source')).toHaveValue(content)
}

test('new document, Save As, rename, and confirmed delete operate on real files', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('latex-source')).toBeVisible()
  await menu(page, 'New Blank Document')
  const name = `new-${Date.now()}.tex`
  await page.getByLabel('File path', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Create Document', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(disk(name)).toContain('\\begin{document}')
  await page.getByTestId('latex-source').fill(original)
  await menu(page, 'Save As')
  const copy = `copy-${Date.now()}.tex`
  await page.getByLabel('File path', { exact: true }).fill(copy)
  await page.getByRole('button', { name: 'Save Copy', exact: true }).click()
  await expect.poll(() => disk(copy)).toBe(original)
  await page.getByRole('button', { name: `Actions for ${copy}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Rename', exact: true }).click()
  const renamed = `renamed-${Date.now()}.tex`
  await page.getByRole('dialog').getByRole('textbox').fill(renamed)
  await page.getByRole('dialog').getByRole('button', { name: 'Rename', exact: true }).click()
  await expect.poll(() => existsSync(join(process.env.NEXTEX_E2E_WORKSPACE!, renamed))).toBe(true)
  expect(existsSync(join(process.env.NEXTEX_E2E_WORKSPACE!, copy))).toBe(false)
  await page.getByRole('button', { name: `Actions for ${renamed}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(existsSync(join(process.env.NEXTEX_E2E_WORKSPACE!, renamed))).toBe(true)
  await page.getByRole('button', { name: `Actions for ${renamed}`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete permanently', exact: true }).click()
  await expect.poll(() => existsSync(join(process.env.NEXTEX_E2E_WORKSPACE!, renamed))).toBe(false)
  await expect(page.getByTestId('latex-source')).toHaveValue('')
})

test('all five templates create standalone documents and compile to real PDFs', async ({ page, request }) => {
  test.setTimeout(120000)
  await page.goto('/')
  await expect(page.getByTestId('latex-source')).toBeVisible()
  for (const template of ['Minimal', 'Professional', 'Modern', 'Academic', 'Creative']) {
    await menu(page, 'New from Template')
    await page.getByRole('dialog').getByRole('button', { name: new RegExp(template) }).click()
    const name = `${template.toLowerCase()}-${Date.now()}.tex`
    await page.getByLabel('File name', { exact: true }).fill(name)
    await page.getByRole('button', { name: 'Create from Template', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(disk(name)).toContain('\\end{document}')
    const build = await request.post(`${backend}/api/compile`, { data: { file_path: name, compiler: 'pdflatex' }, timeout: 60000 })
    expect(build.ok()).toBeTruthy()
    const result = await build.json()
    expect(result.success, JSON.stringify(result.logs)).toBe(true)
    const pdf = await request.get(`${backend}${result.pdf_url}`)
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')
  }
})

test('text replace, undo/redo, save-before-build and PDF preview work without app errors', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const name = `text-${Date.now()}.tex`
  await open(page, request, name)
  const source = page.getByTestId('latex-source')
  await source.focus()
  await source.press('ControlOrMeta+h')
  await page.getByLabel('Find text', { exact: true }).fill('Hello world.')
  await page.getByLabel('Replace with', { exact: true }).fill('Edited paragraph.')
  await page.getByRole('button', { name: 'Replace all', exact: true }).click()
  await expect(source).toHaveValue(original.replace('Hello world.', 'Edited paragraph.'))
  await page.getByRole('button', { name: 'Close find and replace', exact: true }).click()
  await source.press('ControlOrMeta+z')
  await expect(source).toHaveValue(original)
  await source.press('ControlOrMeta+Shift+z')
  await expect(source).toHaveValue(original.replace('Hello world.', 'Edited paragraph.'))
  await source.press('ControlOrMeta+b')
  await expect(page.getByTitle('PDF Preview')).toBeVisible({ timeout: 60000 })
  expect(disk(name)).toContain('Edited paragraph.')
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  await expect(page.getByTitle('PDF Preview')).toHaveAttribute('src', /zoom=125$/)
  await page.getByRole('button', { name: 'Fit page', exact: true }).click()
  await expect(page.getByTitle('PDF Preview')).toHaveAttribute('src', /view=Fit$/)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click()
  const downloaded = await download
  expect(downloaded.suggestedFilename()).toBe(name.replace(/\.tex$/, '.pdf'))
  expect(readFileSync((await downloaded.path())!).subarray(0, 5).toString()).toBe('%PDF-')
  await page.screenshot({ path: join(tmpdir(), 'nextex-desktop.png') })
  expect(errors).toEqual([])
})

test('history records closed-panel edits and restores the original source', async ({ page, request }) => {
  const name = `history-${Date.now()}.tex`
  await open(page, request, name)
  await page.getByTestId('latex-source').fill(original.replace('Hello world.', 'A later edit.'))
  await page.getByTestId('latex-source').press('ControlOrMeta+s')
  await expect.poll(() => disk(name)).toContain('A later edit.')
  await page.getByRole('button', { name: 'Version History', exact: true }).click()
  await page.getByText('Opened', { exact: true }).click()
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(page.getByTestId('latex-source')).toHaveValue(original)
})

test('external file changes produce a conflict and Save As keeps both versions', async ({ page, request }) => {
  const name = `conflict-${Date.now()}.tex`
  await open(page, request, name)
  await request.post(`${backend}/api/files/write`, { data: { path: name, content: 'External changes' } })
  await page.getByTestId('latex-source').fill(original.replace('Hello world.', 'Unsaved browser changes.'))
  await page.getByTestId('latex-source').press('ControlOrMeta+s')
  await expect(page.getByRole('alert').first()).toBeVisible()
  expect(disk(name)).toBe('External changes')
  await page.getByRole('button', { name: 'Save a copy', exact: true }).click()
  const copy = `recovered-${Date.now()}.tex`
  await page.getByLabel('File path', { exact: true }).fill(copy)
  await page.getByRole('button', { name: 'Save Copy', exact: true }).click()
  await expect.poll(() => disk(copy)).toContain('Unsaved browser changes.')
  expect(disk(name)).toBe('External changes')
})

test('narrow layout renders a usable editor without horizontal page overflow', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, request, `mobile-${Date.now()}.tex`)
  const source = page.getByTestId('latex-source')
  await expect(source).toBeVisible()
  const box = await source.boundingBox()
  expect(box!.width).toBeGreaterThan(250)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await source.fill(original.replace('Hello world.', 'Edited on a narrow screen.'))
  await source.press('ControlOrMeta+s')
  await page.screenshot({ path: join(tmpdir(), 'nextex-mobile.png') })
})

test('an unsaved draft survives reload and remains protected until recovery', async ({ page, request }) => {
  const name = `draft-${Date.now()}.tex`
  await open(page, request, name)
  const recovered = original.replace('Hello world.', 'Recovered unsaved browser text.')
  await page.getByTestId('latex-source').fill(recovered)
  await expect.poll(() => page.evaluate((path) => Object.keys(localStorage)
    .filter(key => key.startsWith('nextex-draft:') && key.includes(path))
    .map(key => JSON.parse(localStorage.getItem(key)!).content), name)).toContain(recovered)
  page.once('dialog', dialog => dialog.accept())
  await page.reload()
  await expect(page.getByTestId('latex-source')).toBeVisible()
  await menu(page, 'Open File')
  await page.getByRole('dialog').getByRole('button', { name, exact: true }).click()
  await expect(page.getByRole('button', { name: 'Recover draft', exact: true })).toBeVisible()
  expect(disk(name)).toBe(original)
  await expect(page.locator('[inert]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Recover draft', exact: true }).click()
  await expect(page.getByTestId('latex-source')).toHaveValue(recovered)
  await page.getByTestId('latex-source').press('ControlOrMeta+s')
  await expect.poll(() => disk(name)).toBe(recovered)
  await expect(page.getByRole('button', { name: 'Recover draft', exact: true })).toHaveCount(0)
})

test('real compiler errors point to source and a corrected document builds successfully', async ({ page, request }) => {
  const name = `diagnostics-${Date.now()}.tex`
  const broken = original.replace('Hello world.', '\\notARealNexTexCommand')
  await open(page, request, name, broken)
  const compile = page.waitForResponse(response => response.url() === `${backend}/api/compile` && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Build', exact: true }).click()
  const result = await (await compile).json()
  expect(result.success).toBe(false)
  expect(result.error_lines.some((diagnostic: { file: string; line: number }) => diagnostic.file === name && diagnostic.line === 4)).toBe(true)
  await page.getByRole('button', { name: /Issues/ }).click()
  await page.getByRole('button').filter({ hasText: `${name}:4` }).first().click()
  const source = page.getByTestId('latex-source')
  await expect.poll(() => source.evaluate(element => (element as HTMLTextAreaElement).selectionStart)).toBe(broken.indexOf('\\notARealNexTexCommand'))
  await source.fill(original)
  await source.press('ControlOrMeta+b')
  await expect(page.getByTitle('PDF Preview')).toBeVisible({ timeout: 60000 })
  expect(disk(name)).toBe(original)
})

test('opening a trusted local folder saves the previous document and persists workspace selection', async ({ page, request }) => {
  const name = `workspace-${Date.now()}.tex`
  const folder = mkdtempSync(join(tmpdir(), 'nextex-secondary-'))
  const secondary = original.replace('Hello world.', 'Another workspace.')
  writeFileSync(join(folder, 'secondary.tex'), secondary)
  try {
    await open(page, request, name)
    const changed = original.replace('Hello world.', 'Saved before changing folders.')
    await page.getByTestId('latex-source').fill(changed)
    await menu(page, 'Open Folder')
    await page.getByLabel('Folder path', { exact: true }).fill(folder)
    await page.getByRole('dialog').getByRole('button', { name: 'Open Folder', exact: true }).click()
    await page.getByRole('button', { name: 'Trust and Open', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(disk(name)).toBe(changed)
    await page.getByRole('button', { name: 'secondary.tex', exact: true }).click()
    await expect(page.getByTestId('latex-source')).toHaveValue(secondary)
    await page.reload()
    await expect(page.getByTestId('latex-source')).toHaveValue(secondary)
  } finally {
    const restored = await request.post(`${backend}/api/workspace/select`, { data: { path: process.env.NEXTEX_E2E_WORKSPACE, trusted: true } })
    expect(restored.ok()).toBe(true)
  }
})
