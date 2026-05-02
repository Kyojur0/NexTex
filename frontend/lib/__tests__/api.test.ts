import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as api from '../api'

const API_BASE = 'http://127.0.0.1:8000'

describe('API client', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getWorkspace returns workspace info', async () => {
    const mock = { workspace_root: '/tmp/test', trusted_local_mode: false, source: 'default' }
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mock,
    })
    const result = await api.getWorkspace()
    expect(result).toEqual(mock)
    expect(global.fetch).toHaveBeenCalledWith(`${API_BASE}/api/workspace`)
  })

  it('selectWorkspace sends trusted flag', async () => {
    const mock = { workspace_root: '/tmp/test', trusted_local_mode: true, source: 'user-selected' }
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mock,
    })
    const result = await api.selectWorkspace('/tmp/test', true)
    expect(result.trusted_local_mode).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE}/api/workspace/select`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ path: '/tmp/test', trusted: true }),
      })
    )
  })

  it('selectWorkspace throws on 403', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Forbidden',
      json: async () => ({ detail: 'Trust required' }),
    })
    await expect(api.selectWorkspace('/tmp/test', false)).rejects.toThrow('Trust required')
  })

  it('fetchFileTree returns file nodes', async () => {
    const mock = [{ id: 'file-test.tex', name: 'test.tex', type: 'file', path: 'test.tex' }]
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mock,
    })
    const result = await api.fetchFileTree('')
    expect(result).toEqual(mock)
  })

  it('readFile returns content', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ path: 'a.tex', content: 'hello' }),
    })
    const result = await api.readFile('a.tex')
    expect(result).toBe('hello')
  })

  it('writeFile calls POST', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true })
    await api.writeFile('a.tex', 'content')
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE}/api/files/write`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ path: 'a.tex', content: 'content' }),
      })
    )
  })

  it('createItem calls POST', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true })
    await api.createItem('folder', 'folder')
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE}/api/files/create`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ path: 'folder', type: 'folder' }),
      })
    )
  })

  it('renameItem calls POST', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true })
    await api.renameItem('old.tex', 'new.tex')
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE}/api/files/rename`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ old_path: 'old.tex', new_path: 'new.tex' }),
      })
    )
  })

  it('deleteItem calls POST', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true })
    await api.deleteItem('del.tex')
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_BASE}/api/files/delete`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ path: 'del.tex' }),
      })
    )
  })

  it('compileLaTeX returns result', async () => {
    const mock = {
      build_id: 'abc',
      success: true,
      logs: [],
      pdf_available: true,
      pdf_url: '/api/compile/abc/pdf',
      build_dir: '/tmp/build',
    }
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mock,
    })
    const result = await api.compileLaTeX('doc.tex', 'pdflatex')
    expect(result.pdf_available).toBe(true)
    expect(result.pdf_url).toBe('/api/compile/abc/pdf')
  })

  it('getPdfUrl returns correct URL', () => {
    expect(api.getPdfUrl('abc')).toBe(`${API_BASE}/api/compile/abc/pdf`)
  })
})
