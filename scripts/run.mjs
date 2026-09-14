import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const frontend = join(root, 'frontend')
const python = join(root, 'backend', 'venv', 'bin', 'python')
const next = join(frontend, 'node_modules', 'next', 'dist', 'bin', 'next')
const production = process.argv.includes('--production')
const webPort = Number(process.env.NEXTEX_WEB_PORT || 3000)
let apiPort = Number(process.env.NEXTEX_API_PORT || 8000)
if (production) {
  try {
    const built = JSON.parse(readFileSync(join(frontend, '.next/nextex-runtime.json'), 'utf8'))
    const buildId = readFileSync(join(frontend, '.next/BUILD_ID'), 'utf8').trim()
    if (built.buildId !== buildId || !Number.isInteger(built.apiPort)) throw new Error('Stale build configuration')
    if (process.env.NEXTEX_API_PORT && apiPort !== built.apiPort) throw new Error('The API port differs from the compiled frontend')
    apiPort = built.apiPort
  } catch (error) {
    console.error(`${error.message}. Run npm run build from the project root with the desired NEXTEX_API_PORT before starting production.`)
    process.exit(1)
  }
}
if (![webPort, apiPort].every(port => Number.isInteger(port) && port > 0 && port <= 65535) || webPort === apiPort) {
  console.error('Choose two distinct valid ports with NEXTEX_WEB_PORT and NEXTEX_API_PORT.'); process.exit(1)
}
if (!existsSync(python) || !existsSync(next)) {
  console.error('Dependencies are missing. Run npm run setup from the project root.'); process.exit(1)
}
if (production && !existsSync(join(frontend, '.next', 'BUILD_ID'))) {
  console.error('Production build is missing. Run npm run build first.'); process.exit(1)
}
const children = []
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  setTimeout(() => { for (const child of children) child.kill('SIGKILL'); process.exit(code) }, 5000).unref()
  process.exitCode = code
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop())
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXTEX_DIST_DIR: '.next', NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
  NEXTEX_API_URL: `http://127.0.0.1:${apiPort}`,
  NEXTEX_ALLOWED_ORIGINS: process.env.NEXTEX_ALLOWED_ORIGINS || `http://127.0.0.1:${webPort},http://localhost:${webPort}` }
function launch(command, args, cwd) {
  const child = spawn(command, args, { cwd, env, stdio: 'inherit' })
  children.push(child)
  child.on('error', error => { console.error(error.message); stop(1) })
  child.on('exit', code => { if (!stopping) stop(code || 1) })
}
// Fail before launching either service if an existing process owns either port.
for (const port of [apiPort, webPort]) {
  try {
    await new Promise((resolve, reject) => {
      const server = createServer()
      server.once('error', reject)
      server.listen(port, '127.0.0.1', () => server.close(resolve))
    })
  } catch {
    console.error(`Port ${port} is already in use. Stop that service or select a different NexTex port.`)
    process.exit(1)
  }
}
launch(python, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(apiPort), '--timeout-graceful-shutdown', '1'], join(root, 'backend'))
let ready = false
for (let attempt = 0; attempt < 40 && !stopping; attempt++) {
  try { ready = (await fetch(`http://127.0.0.1:${apiPort}/health`)).ok } catch { /* startup in progress */ }
  if (ready) break
  await new Promise(resolve => setTimeout(resolve, 250))
}
if (!ready) { console.error('The local compiler service did not start. See the error above.'); stop(1) }
else if (!stopping) {
  launch(process.execPath, [next, production ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', String(webPort)], frontend)
  console.log(`\nNexTex: http://127.0.0.1:${webPort}\nPress Ctrl+C to stop both services.\n`)
}
