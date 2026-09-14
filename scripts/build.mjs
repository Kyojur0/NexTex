import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const frontend = join(root, 'frontend')
const apiPort = Number(process.env.NEXTEX_API_PORT || 8000)
if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
  console.error('NEXTEX_API_PORT must be a valid port.'); process.exit(1)
}
const child = spawn(process.execPath, [join(frontend, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], {
  cwd: frontend,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NEXTEX_DIST_DIR: '.next', NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}` },
  stdio: 'inherit',
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', (code) => {
  if (code !== 0) { process.exitCode = code || 1; return }
  const buildId = readFileSync(join(frontend, '.next/BUILD_ID'), 'utf8').trim()
  writeFileSync(join(frontend, '.next/nextex-runtime.json'), JSON.stringify({ buildId, apiPort }))
})
