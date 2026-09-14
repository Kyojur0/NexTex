// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST } from '@/app/api/ai/suggest/route'
import { NextRequest } from 'next/server'

const { generateText } = vi.hoisted(() => ({ generateText: vi.fn() }))
vi.mock('ai', () => ({ generateText }))

const request = (body: unknown, origin = 'http://localhost:3000') => new Request('http://localhost:3000/api/ai/suggest', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
})
const payload = { prompt: 'Improve clarity', code: 'Original text', model: 'provider/model' }

describe('AI route provider boundary', () => {
  beforeEach(() => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '')
    vi.stubEnv('NEXTEX_AI_BASE_URL', '')
    vi.stubEnv('NEXTEX_AI_API_KEY', '')
    generateText.mockReset()
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it('reports missing configuration without attempting generation', async () => {
    const status = await GET()
    expect(await status.json()).toMatchObject({ configured: false })
    expect((await POST(request(payload))).status).toBe(503)
    expect(generateText).not.toHaveBeenCalled()
  })

  it('rejects foreign origins, malformed JSON, non-string fields, and oversized input', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'secret')
    expect((await POST(request(payload, 'https://untrusted.example'))).status).toBe(403)
    const malformed = new Request('http://localhost:3000/api/ai/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })
    expect((await POST(malformed)).status).toBe(400)
    expect((await POST(request({ ...payload, code: {} }))).status).toBe(400)
    expect((await POST(request({ ...payload, model: 'bad model\n' }))).status).toBe(400)
    expect((await POST(request({ ...payload, code: 'x'.repeat(250001) }))).status).toBe(413)
    expect(generateText).not.toHaveBeenCalled()
  })

  it('uses the incoming loopback Host when Next normalizes its internal request URL', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'secret')
    generateText.mockResolvedValue({ text: 'Improved text', finishReason: 'stop' })
    const browserRequest = new NextRequest('http://127.0.0.1:3011/api/ai/suggest', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Host: '127.0.0.1:3011', Origin: 'http://127.0.0.1:3011', 'Sec-Fetch-Site': 'same-origin' }, body: JSON.stringify(payload),
    })
    expect(new URL(browserRequest.url).hostname).toBe('localhost')
    expect((await POST(browserRequest)).status).toBe(200)
  })

  it('does not accept foreign, rebound, forwarded, or different-port origins through Host handling', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'secret')
    const cases: Array<Record<string, string>> = [
      { Host: '127.0.0.1:3011', Origin: 'https://untrusted.example' },
      { Host: 'untrusted.example:3011', Origin: 'http://untrusted.example:3011' },
      { Host: '127.0.0.1:3011', Origin: 'http://127.0.0.1:3012' },
      { Host: '127.0.0.1:3011', Origin: 'http://localhost:3011' },
      { Host: '127.0.0.1:3011', Origin: 'https://untrusted.example', 'X-Forwarded-Host': 'untrusted.example' },
    ]
    for (const headers of cases) {
      const browserRequest = new NextRequest('http://127.0.0.1:3011/api/ai/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(payload) })
      expect((await POST(browserRequest)).status).toBe(403)
    }
    expect(generateText).not.toHaveBeenCalled()
  })

  it('accepts a complete gateway response and bounds the request', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'secret')
    generateText.mockResolvedValue({ text: '```latex\nImproved text\n```', finishReason: 'stop' })
    const response = await POST(request(payload))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ suggestion: 'Improved text\n' })
    expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ model: 'provider/model', maxRetries: 0, abortSignal: expect.any(AbortSignal) }))
    expect(JSON.stringify(await (await GET()).json())).not.toContain('secret')
  })

  it('preserves indentation and final newlines in plain provider source', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'secret')
    const source = '  \\textbf{Indented paragraph}\n\n'
    generateText.mockResolvedValue({ text: source, finishReason: 'stop' })
    expect(await (await POST(request(payload))).json()).toEqual({ suggestion: source })
  })

  it('strips fence lines without trimming the source inside them', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'secret')
    generateText.mockResolvedValue({ text: '```latex\n  \\textbf{Indented paragraph}\n\n```', finishReason: 'stop' })
    expect(await (await POST(request(payload))).json()).toEqual({ suggestion: '  \\textbf{Indented paragraph}\n\n' })
  })

  it('uses the configured local OpenAI-compatible endpoint without requiring a key', async () => {
    vi.stubEnv('NEXTEX_AI_BASE_URL', 'http://127.0.0.1:1234/v1')
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: 'Local suggestion' }, finish_reason: 'stop' }] }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await (await POST(request(payload))).json()).toEqual({ suggestion: 'Local suggestion' })
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:1234/v1/chat/completions', expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }))
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization')
    expect(generateText).not.toHaveBeenCalled()
  })

  it('rejects insecure remote endpoints and missing remote credentials', async () => {
    vi.stubEnv('NEXTEX_AI_BASE_URL', 'http://provider.example/v1')
    expect((await POST(request(payload))).status).toBe(503)
    vi.stubEnv('NEXTEX_AI_BASE_URL', 'https://provider.example/v1')
    expect((await POST(request(payload))).status).toBe(503)
  })

  it('rejects empty and truncated results and hides provider error details', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'secret')
    generateText.mockResolvedValueOnce({ text: '', finishReason: 'stop' })
    expect((await POST(request(payload))).status).toBe(502)
    generateText.mockResolvedValueOnce({ text: 'partial', finishReason: 'length' })
    expect((await POST(request(payload))).status).toBe(502)
    generateText.mockRejectedValueOnce(new Error('secret token and original document'))
    const response = await POST(request(payload))
    expect(response.status).toBe(502)
    expect(JSON.stringify(await response.json())).not.toMatch(/secret token|original document/)
  })

  it('cancels a stalled gateway request within the configured timeout', async () => {
    vi.useFakeTimers()
    vi.stubEnv('AI_GATEWAY_API_KEY', 'secret')
    generateText.mockImplementation(({ abortSignal }: { abortSignal: AbortSignal }) => new Promise((_resolve, reject) => {
      abortSignal.addEventListener('abort', () => reject(new Error('Cancelled')), { once: true })
    }))
    const pending = POST(request(payload))
    await vi.waitFor(() => expect(generateText).toHaveBeenCalled())
    await vi.advanceTimersByTimeAsync(45_000)
    const response = await pending
    expect(response.status).toBe(504)
    expect((await response.json()).error).toMatch(/timed out/)
  })

  it('never accepts a full document response missing its document ending', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'secret')
    generateText.mockResolvedValue({ text: '\\begin{document}\nPartial', finishReason: 'stop' })
    expect((await POST(request({ ...payload, code: '\\begin{document}\nOriginal\n\\end{document}' }))).status).toBe(502)
  })
})
