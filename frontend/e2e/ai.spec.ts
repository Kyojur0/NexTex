import { test, expect, type Page, type APIRequestContext } from 'playwright/test'

const BACKEND = 'http://127.0.0.1:8011'
const ORIGINAL = '\\documentclass{article}\n\\begin{document}\nHello world.\n\\end{document}\n'
let createdPath = ''

async function openSyntheticDocument(page: Page, request: APIRequestContext, source = ORIGINAL) {
  createdPath = `ai-e2e-${Date.now()}-${Math.random().toString(16).slice(2)}.tex`
  const result = await request.post(`${BACKEND}/api/files/create`, { data: { path: createdPath, type: 'file', content: source } })
  expect(result.ok()).toBeTruthy()
  await page.goto('/')
  await expect(page.getByTestId('latex-source')).toBeVisible()
  await page.getByRole('button', { name: 'File', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Open File', exact: true }).click()
  await page.getByLabel('Search files or enter a path').fill(createdPath)
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  await expect(page.getByTestId('latex-source')).toHaveValue(source)
  return createdPath
}

async function requestSuggestion(page: Page, prompt = 'Fix grammar and improve clarity') {
  await page.getByRole('button', { name: 'AI assistant', exact: true }).click()
  const input = page.getByRole('textbox', { name: 'AI instruction' })
  await expect(input).toBeEnabled()
  await input.fill(prompt)
  await page.getByRole('button', { name: 'Generate suggestion' }).click()
}

async function diskContent(request: APIRequestContext, path: string) {
  const response = await request.get(`${BACKEND}/api/files/read`, { params: { path } })
  expect(response.ok()).toBeTruthy()
  return (await response.json()).content as string
}

test.afterEach(async ({ request }) => {
  if (createdPath) {
    await request.post(`${BACKEND}/api/files/delete`, { data: { path: createdPath } })
    createdPath = ''
  }
})

test('reviews a real local provider response, rejects it, then accepts and saves it', async ({ page, request }) => {
  const path = await openSyntheticDocument(page, request)
  await requestSuggestion(page)
  await expect(page.getByRole('button', { name: 'Accept changes' })).toBeEnabled()
  await expect(page.getByText('AI improved this paragraph.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reject', exact: true }).click()
  await page.getByRole('button', { name: 'Close AI assistant' }).click()
  await expect(page.getByTestId('latex-source')).toHaveValue(ORIGINAL)
  expect(await diskContent(request, path)).toBe(ORIGINAL)

  await requestSuggestion(page)
  await page.getByRole('button', { name: 'Accept changes' }).click()
  const expected = ORIGINAL.replace('Hello world.', 'AI improved this paragraph.')
  await expect(page.getByTestId('latex-source')).toHaveValue(expected)
  await page.getByTestId('latex-source').press('ControlOrMeta+s')
  await expect.poll(() => diskContent(request, path)).toBe(expected)
})

test('rejects a truncated provider result without changing the document', async ({ page, request }) => {
  const path = await openSyntheticDocument(page, request)
  await requestSuggestion(page, '[test:truncate] Improve clarity')
  await expect(page.getByRole('alert')).toContainText('incomplete')
  await expect(page.getByRole('button', { name: 'Accept changes' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Close AI assistant' }).click()
  await expect(page.getByTestId('latex-source')).toHaveValue(ORIGINAL)
  expect(await diskContent(request, path)).toBe(ORIGINAL)
})

test('blocks a suggestion when the source changes before acceptance', async ({ page, request }) => {
  await openSyntheticDocument(page, request)
  await requestSuggestion(page)
  await expect(page.getByRole('button', { name: 'Accept changes' })).toBeEnabled()
  // Exercise an actual editor update while review remains open (for example,
  // a command from another application integration), without touching stores.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('editor:command', { detail: { command: 'insert', text: '% Concurrent local change\n' } })))
  await expect(page.getByRole('alert')).toContainText('document changed')
  await expect(page.getByRole('button', { name: 'Accept changes' })).toBeDisabled()
})

test('uses the selected occurrence when the same passage appears twice', async ({ page, request }) => {
  const source = ORIGINAL.replace('Hello world.', 'Hello world.\n\nHello world.')
  const path = await openSyntheticDocument(page, request, source)
  const selectedStart = source.lastIndexOf('Hello world.')
  await page.getByTestId('latex-source').evaluate((element, start) => {
    const textarea = element as HTMLTextAreaElement
    textarea.focus()
    textarea.setSelectionRange(start, start + 'Hello world.'.length)
  }, selectedStart)
  await requestSuggestion(page)
  await expect(page.getByText(/Your selection will be sent/)).toBeVisible()
  await page.getByRole('button', { name: 'Accept changes' }).click()
  const expected = source.slice(0, selectedStart) + 'AI improved this paragraph.' + source.slice(selectedStart + 'Hello world.'.length)
  await expect(page.getByTestId('latex-source')).toHaveValue(expected)
  await page.getByTestId('latex-source').press('ControlOrMeta+s')
  await expect.poll(() => diskContent(request, path)).toBe(expected)
})
