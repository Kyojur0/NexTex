// Test-only OpenAI-compatible provider. This process is started by Playwright,
// bound to loopback, and receives only synthetic documents created by the tests.
import { createServer } from 'node:http'

const reply = (response, status, data) => {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(data))
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    reply(response, 200, { ok: true, fixture: 'nextex-ai-e2e' })
    return
  }
  if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
    reply(response, 404, { error: 'Not found' })
    return
  }
  try {
    let body = ''
    for await (const chunk of request) {
      body += chunk.toString()
      if (body.length > 2_000_000) { reply(response, 413, { error: 'Too large' }); return }
    }
    const payload = JSON.parse(body)
    const userMessage = payload.messages?.find((message) => message.role === 'user')?.content
    const marker = '\n\nLaTeX source:\n'
    if (typeof userMessage !== 'string' || !userMessage.includes(marker)) {
      reply(response, 400, { error: 'Expected a synthetic LaTeX request' })
      return
    }
    const boundary = userMessage.indexOf(marker)
    const instruction = userMessage.slice(0, boundary)
    const code = userMessage.slice(boundary + marker.length)
    if (instruction.includes('[test:error]')) { reply(response, 503, { error: 'Deliberate fixture failure' }); return }
    const truncated = instruction.includes('[test:truncate]')
    const empty = instruction.includes('[test:empty]')
    const suggestion = empty ? '' : code.replaceAll('Hello world.', 'AI improved this paragraph.')
    const result = { id: 'nextex-e2e-completion', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: truncated ? suggestion.slice(0, 10) : suggestion }, finish_reason: truncated ? 'length' : 'stop' }] }
    if (instruction.includes('[test:delay]')) setTimeout(() => reply(response, 200, result), 500)
    else reply(response, 200, result)
  } catch {
    reply(response, 400, { error: 'Invalid test request' })
  }
})

server.listen(8012, '127.0.0.1')
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)))
