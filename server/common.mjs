import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises'
import { homedir, networkInterfaces } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

export const ROOT = fileURLToPath(new URL('../', import.meta.url))
export const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
export const DATA_DIR = resolve(process.env.FINPLOT_DATA_DIR || (process.platform === 'darwin'
  ? `${homedir()}/Library/Application Support/Finplot` : `${homedir()}/.local/share/finplot`))
const exec = promisify(execFile)
export async function run(command, args, options = {}) {
  const result = await exec(command, args, { timeout: 60_000, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, ...options })
  return result.stdout.trim()
}
export async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
  await rename(temporary, path)
}
export async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf8')) }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error }
}
export function httpError(status, message) { return Object.assign(new Error(message), { status }) }
export function isTailscaleIPv4(host) {
  const parts = host.split('.').map(Number)
  return /^\d+\.\d+\.\d+\.\d+$/.test(host) && parts.every(p => p >= 0 && p <= 255)
    && parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127
}
export async function networkConfig(env = process.env) {
  const port = Number(env.FINPLOT_PORT || 3210)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('FINPLOT_PORT 必须在 1–65535 之间。')
  const host = env.FINPLOT_HOST || 'auto'
  if (host !== 'auto' && host !== '127.0.0.1' && !isTailscaleIPv4(host)) {
    throw new Error('FINPLOT_HOST 仅支持 auto、127.0.0.1 或 Tailscale IPv4。')
  }
  let tailnet = isTailscaleIPv4(host) ? host : null
  if (host === 'auto') {
    for (const binary of [env.FINPLOT_TAILSCALE, 'tailscale', '/usr/local/bin/tailscale', '/Applications/Tailscale.app/Contents/MacOS/Tailscale'].filter(Boolean)) {
      try {
        const value = (await run(binary, ['ip', '-4'], { timeout: 3000 })).split(/\s+/)[0]
        const assigned = Object.values(networkInterfaces()).flat().some(address => address?.address === value)
        if (isTailscaleIPv4(value) && assigned) { tailnet = value; break }
      } catch { /* Loopback remains usable when Tailscale is unavailable. */ }
    }
  }
  return { port, hosts: ['127.0.0.1', ...(tailnet ? [tailnet] : [])], tailnet }
}
