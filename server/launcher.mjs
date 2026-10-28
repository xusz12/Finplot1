import { fork } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { atomicJson, readJson, networkConfig, ROOT, DATA_DIR, manifest } from './common.mjs'
import { createUpdater, compareVersions } from './updates.mjs'
import { acquireLaunchLock, retireExisting, createInstance } from './instance.mjs'

await mkdir(DATA_DIR, { recursive: true, mode: 0o700 })
const config = await networkConfig()
const activePath = join(DATA_DIR, 'active.json')
let active, child, stopping = false, retiring = false, switching = false, ready = false
let restartTimer, checkTimer, releaseLaunch, control, handoffUntil = 0
const processes = new Set()
const startupAbort = new AbortController()
let updater

async function selectedRelease() {
  const saved = await readJson(activePath)
  // Prefer the current checkout at the same version; retain a newer managed release.
  const selected = saved && compareVersions(saved.version, manifest.version) > 0 ? { ...saved } : { ...saved, root: ROOT, version: manifest.version }
  delete selected.pending
  return selected
}
function requestShutdown() {
  handoffUntil = Date.now() + 5000
  if (!ready || switching || ['installing', 'checking'].includes(updater?.snapshot().phase)) return { ok: false, status: 'waiting' }
  setImmediate(() => void shutdown())
  return { ok: true }
}

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
    if (target === child && !retiring && !stopping && !switching) {
      console.error('服务退出，3 秒后重新启动。')
      restartTimer = setTimeout(() => restart().catch(fatal), 3000)
    }
  })
  target.on('message', async message => {
    if (!message.id || !updater) return
    try {
      if (message.action !== 'state' && (retiring || Date.now() < handoffUntil)) throw Object.assign(new Error('实例正在交接，请稍后重试。'), { status: 409 })
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
async function shutdown(code = 0) {
  if (retiring) return
  retiring = true
  startupAbort.abort()
  clearTimeout(restartTimer); clearInterval(checkTimer)
  await startup.catch(() => {})
  await updater?.settled()
  stopping = true
  await Promise.all([...processes].map(stopChild))
  await control?.close()
  await releaseLaunch?.()
  process.exit(code)
}
function fatal(error) { console.error(error); void shutdown(1) }
async function checkUpdates() { if (!retiring && Date.now() >= handoffUntil) await updater.check() }
async function boot() {
  releaseLaunch = await acquireLaunchLock(DATA_DIR, { signal: startupAbort.signal })
  active = await selectedRelease()
  // Fail obvious installation problems before stopping a healthy old instance.
  await readFile(join(active.root, 'dist/index.html'))
  await readFile(join(active.root, 'server/worker.mjs'))
  const build = await readJson(join(active.root, 'dist/version.json'))
  if (build?.version !== active.version) throw new Error('构建版本不一致，请先运行 npm run build。')
  const saved = await readJson(activePath)
  await retireExisting(DATA_DIR, { replace: process.argv.includes('--replace-existing'), roots: [ROOT, saved?.root].filter(Boolean), signal: startupAbort.signal })
  startupAbort.signal.throwIfAborted()
  // A previous update may have completed while this launch was waiting.
  active = await selectedRelease()
  control = await createInstance({ dataDir: DATA_DIR, root: ROOT, onShutdown: requestShutdown,
    onStatus: () => ({ ok: true, ready: ready && !retiring && !switching && child?.exitCode === null && child?.signalCode === null,
      pid: process.pid, workerPid: child?.pid, version: active.version }) })
  updater = await createUpdater({ repository: manifest.repository.url, version: active.version, dataDir: DATA_DIR, activate })
  await restart()
  await atomicJson(activePath, active)
  ready = true
  console.log(`Finplot v${active.version}\n${config.hosts.map(host => `http://${host}:${config.port}`).join('\n')}`)
  await releaseLaunch()
  checkTimer = setInterval(() => checkUpdates().catch(console.error), 6 * 60 * 60 * 1000)
  void delay(2000).then(checkUpdates).catch(console.error)
}
const startup = boot()
process.on('SIGINT', () => shutdown())
process.on('SIGTERM', () => shutdown())
try { await startup } catch (error) { if (!retiring) { console.error(error); await shutdown(1) } }
