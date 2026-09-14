import { test, expect, type APIRequestContext } from 'playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const backend = 'http://127.0.0.1:8011'
let requestId = 0

async function call(request: APIRequestContext, name: string, args: Record<string, unknown> = {}) {
  const response = await request.post(`${backend}/mcp`, {
    headers: { Accept: 'application/json, text/event-stream', 'Mcp-Protocol-Version': '2025-03-26' },
    data: { jsonrpc: '2.0', id: ++requestId, method: 'tools/call', params: { name, arguments: args } }, timeout: 80000,
  })
  expect(response.ok()).toBe(true)
  const body = await response.json()
  expect(body.error).toBeUndefined()
  return body.result
}
const expected = (state: Record<string, unknown>) => ({ expected_workspace_root: state.workspace_root,
  expected_path: state.path, expected_content_sha256: state.content_sha256 })

test('MCP controls unsaved source, conflicts, undo, save, mode and PDF build in a real browser', async ({ page, request }) => {
  test.setTimeout(120000)
  const pageErrors: string[] = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('editor-store', JSON.stringify({
    state: { settings: { fontSize: 14, tabSize: 2, wordWrap: true, autoSave: false, buildOnSave: false,
      compiler: 'pdflatex', colorPalette: 'monochrome', enableSyntaxHighlight: false,
      aiModel: 'openai/gpt-4o-mini', aiProvider: 'openai' } }, version: 0,
  })))
  const initial = '\\documentclass{article}\n\\begin{document}\nMCP browser fixture.\n\\end{document}\n'
  const path = `mcp-${Date.now()}.tex`
  expect((await call(request, 'create_file', { path, content: initial })).isError).toBe(false)
  await page.goto('/')
  await expect(page.getByTestId('latex-source')).toBeVisible()
  let sessionId = ''
  await expect.poll(async () => {
    const result = await call(request, 'list_editors')
    const sessions = result.structuredContent.sessions
    sessionId = sessions[0]?.session_id || ''
    return !!sessionId && !!sessions[0].path
  }).toBe(true)
  const read = async () => {
    const result = await call(request, 'read_editor', { session_id: sessionId })
    expect(result.isError, JSON.stringify(result)).toBe(false)
    return result.structuredContent.state
  }
  const action = async (actionName: string, extra: Record<string, unknown> = {}) => {
    const result = await call(request, 'editor_action', { session_id: sessionId, action: actionName,
      ...expected(await read()), ...extra })
    expect(result.isError, JSON.stringify(result)).toBe(false)
    return result.structuredContent.state
  }
  await action('open', { path })
  await expect(page.getByTestId('latex-source')).toHaveValue(initial)
  const human = initial.replace('MCP browser fixture.', 'Unsaved human edit.')
  await page.getByTestId('latex-source').fill(human)
  const before = await read()
  expect(before.content).toBe(human)
  expect(before.is_modified).toBe(true)
  const changed = human.replace('Unsaved human edit.', 'Agent and human working together.')
  const edit = await call(request, 'edit_editor', { session_id: sessionId, ...expected(before), content: changed })
  expect(edit.isError, JSON.stringify(edit)).toBe(false)
  await expect(page.getByTestId('latex-source')).toHaveValue(changed)
  const stale = await call(request, 'edit_editor', { session_id: sessionId, ...expected(before), content: 'Stale overwrite' })
  expect(stale.isError).toBe(true)
  await expect(page.getByTestId('latex-source')).toHaveValue(changed)
  expect((await action('undo')).content).toBe(human)
  expect((await action('redo')).content).toBe(changed)
  await action('save')
  expect(readFileSync(join(process.env.NEXTEX_E2E_WORKSPACE!, path), 'utf8')).toBe(changed)
  const bypass = await call(request, 'write_file', { path: './' + path, content: 'External overwrite', expected_revision: (await read()).revision })
  expect(bypass.isError).toBe(true)
  await action('set_mode', { mode: 'visual' })
  expect((await read()).mode).toBe('visual')
  await expect(page.getByTestId('visual-document')).toContainText('Agent and human working together.')
  const visualChange=changed.replace('Agent and human working together.', 'Updated by MCP in Visual mode.')
  expect((await call(request,'edit_editor',{session_id:sessionId,...expected(await read()),content:visualChange})).isError).toBe(false)
  await expect(page.getByTestId('visual-document')).toContainText('Updated by MCP in Visual mode.')
  expect((await action('undo')).content).toBe(changed)
  await expect(page.getByTestId('visual-document')).toContainText('Agent and human working together.')
  await action('set_mode', { mode: 'text' })
  const built = await action('build')
  expect(built.pdf_url).toContain('/api/compile/')
  await expect(page.getByTitle('PDF Preview')).toBeVisible()
  const pdf = await request.get(built.pdf_url)
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')
  expect(pageErrors).toEqual([])
})
