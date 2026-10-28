import { fork } from 'node:child_process'
import { createServer, createConnection } from 'node:net'
import { mkdir, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import { atomicJson, readJson, networkConfig, ROOT, DATA_DIR, manifest } from './common.mjs'
import { createUpdater, compareVersions } from './updates.mjs'

await mkdir(DATA_DIR, { recursive: true, mode: 0o700 })
// An OS-owned local socket prevents duplicate supervisors, including separate ports.
const lockPath = join(tmpdir(), `finplot-${process.getuid?.() ?? 'user'}-${createHash('sha256').update(DATA_DIR).digest('hex').slice(0, 16)}.sock`)
const lock = createServer(socket => socket.end())
async function acquire() {
  const alive = await new Promise(resolve => {
    const client = createConnection(lockPath)
    client.once('connect', () => { client.end(); resolve(true) })
    client.once('error', () => resolve(false))
  })
  if (alive) throw new Error('此账本服务已经运行。请打开现有服务或先停止守护进程。')
  await rm(lockPath, { force: true })
  await new Promise((resolve, reject) => { lock.once('error', reject); lock.listen(lockPath, resolve) })
}
await acquire()
const config = await networkConfig()
const activePath = join(DATA_DIR, 'active.json')
let active = await readJson(activePath, { root: ROOT, version: manifest.version })
delete active.pending
// A newer manually installed checkout takes precedence over an older managed release.
if (compareVersions(manifest.version, active.version) > 0) active = { root: ROOT, version: manifest.version }
let child, stopping = false, switching = false, restartTimer
const processes = new Set()
let updater

async function stopChild(target) {
  if (!target || target.exitCode !== null || target.signalCode !== null) return
  await new Promise(resolve => {
    const timeout = setTimeout(() => target.kill('SIGKILL'), 10_000)
    target.once('exit', () => { clearTimeout(timeout); resolve() })
    target.kill('SIGTERM')
  })
}
async function launch(root, version) {
  const instance = randomUUID()
  const target = fork(join(root, 'server/worker.mjs'), [], { cwd: root,
    env: { ...process.env, FINPLOT_DATA_DIR: DATA_DIR, FINPLOT_NETWORK: JSON.stringify(config), FINPLOT_INSTANCE: instance },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'] })
  processes.add(target)
  target.on('exit', () => {
    processes.delete(target)
    if (target === child && !stopping && !switching) {
      console.error('服务退出，3 秒后重新启动。')
      restartTimer = setTimeout(() => restart().catch(fatal), 3000)
    }
  })
  target.on('message', async message => {
    if (!message.id || !updater) return
    try {
      const result = message.action === 'state' ? updater.snapshot() : message.action === 'check' ? await updater.check()
        : message.action === 'install' ? await updater.install(message.version) : null
      if (target.connected) target.send({ id: message.id, result })
    } catch (error) { if (target.connected) target.send({ id: message.id, error: error.message, status: error.status }) }
  })
  try {
    const ready = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('服务启动超时。')), 30_000)
      target.once('error', error => { clearTimeout(timer); reject(error) })
      target.once('exit', () => { clearTimeout(timer); reject(new Error('服务未能启动。')) })
      target.on('message', message => { if (message.ready && message.instance === instance) { clearTimeout(timer); resolve(true) } })
    })
    if (ready) {
      const url = `http://127.0.0.1:${config.port}`
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(3000) })
      const health = await response.json()
      if (health.instance !== instance || health.version !== version) throw new Error('服务身份或版本检查失败。')
      const page = await fetch(url, { signal: AbortSignal.timeout(3000) })
      const html = await page.text()
      if (!page.ok || !html.includes('<div id="root">')) throw new Error('页面健康检查失败。')
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g)].map(match => match[1])
      for (const asset of assets) {
        const result = await fetch(url + asset, { signal: AbortSignal.timeout(3000) })
        await result.arrayBuffer()
        if (!result.ok) throw new Error('页面资源健康检查失败。')
      }
    }
    return target
  } catch (error) { await stopChild(target); throw error }
}
async function restart() { child = await launch(active.root, active.version) }
async function activate(root, version) {
  if (stopping) throw new Error('服务正在停止，请重新启动后再更新。')
  switching = true
  clearTimeout(restartTimer)
  const previous = { ...active }
  try {
    // Validate the release before taking the current service down.
    await readFile(join(root, 'dist/index.html'))
    await atomicJson(activePath, { ...previous, pending: { root, version } })
    await stopChild(child)
    child = await launch(root, version)
    active = { root, version, previous }
    await atomicJson(activePath, active)
    console.log(`已更新至 v${version}`)
  } catch (error) {
    await stopChild(child)
    active = previous
    await atomicJson(activePath, previous)
    child = await launch(previous.root, previous.version)
    throw error
  } finally { switching = false }
}
updater = await createUpdater({ repository: manifest.repository.url, version: active.version, dataDir: DATA_DIR, activate })
async function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  clearTimeout(restartTimer); clearInterval(checkTimer)
  await Promise.all([...processes].map(stopChild))
  lock.close()
  await rm(lockPath, { force: true })
  process.exit(code)
}
function fatal(error) { console.error(error); void shutdown(1) }
const checkTimer = setInterval(() => updater.check().catch(console.error), 6 * 60 * 60 * 1000)
try {
  await restart()
  await atomicJson(activePath, active)
  console.log(`Finplot v${active.version}\n${config.hosts.map(host => `http://${host}:${config.port}`).join('\n')}`)
  void delay(2000).then(() => { if (!stopping) return updater.check() }).catch(console.error)
} catch (error) { console.error(error); await shutdown(1) }
process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())
