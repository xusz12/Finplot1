import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { ROOT, DATA_DIR, run, networkConfig, readJson } from '../server/common.mjs'
import { acquireLaunchLock, retireExisting, instancePaths, requestControl } from '../server/instance.mjs'

const label = 'com.finplot.service'
const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
function plistValue(value) {
  if (typeof value === 'boolean') return value ? '<true/>' : '<false/>'
  if (typeof value === 'number') return `<integer>${value}</integer>`
  if (Array.isArray(value)) return `<array>${value.map(plistValue).join('')}</array>`
  if (typeof value === 'object') return `<dict>${Object.entries(value).map(([key, item]) => `<key>${xml(key)}</key>${plistValue(item)}`).join('')}</dict>`
  return `<string>${xml(value)}</string>`
}
export function renderPlist(config) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">${plistValue(config)}</plist>\n`
}

async function retire(dataDir, roots) {
  const release = await acquireLaunchLock(dataDir)
  try {
    const active = await readJson(join(dataDir, 'active.json'))
    await retireExisting(dataDir, { roots: [...roots, active?.root].filter(Boolean) })
  } finally { await release() }
}

export async function waitForService({ dataDir, target, execute = run, timeout = 35_000 }) {
  const deadline = Date.now() + timeout, paths = instancePaths(dataDir)
  while (Date.now() < deadline) {
    try {
      const owner = await readJson(paths.owner)
      const status = owner?.token && await requestControl(paths.socket, { action: 'status', token: owner.token })
      const job = await execute('launchctl', ['print', target])
      if (status?.ready && new RegExp(`\\bpid = ${status.pid}\\b`).test(job)) return
    } catch { /* Wait through startup; success requires the managed owner and health checks. */ }
    await delay(150)
  }
  throw new Error('守护进程启动后的健康检查未通过，请查看数据目录中的 logs/error.log。')
}

export async function manageService(action, { home = homedir(), uid = process.getuid?.(), root = ROOT, dataDir = DATA_DIR,
  node = process.execPath, env = process.env, platform = process.platform, execute = run, retireInstance = retire,
  configureNetwork = networkConfig, waitForReady = waitForService, serviceLabel = label } = {}) {
  if (platform !== 'darwin') throw new Error('守护进程安装目前支持 macOS；其他系统可使用 npm start 交给进程管理器运行。')
  const domain = `gui/${uid}`, target = `${domain}/${serviceLabel}`
  const plist = join(home, 'Library/LaunchAgents', `${serviceLabel}.plist`)
  const bootout = async () => {
    try { await execute('launchctl', ['bootout', target]) }
    catch (error) { if (!/Could not find service|No such process/.test(error.stderr || '')) throw error }
  }
  const load = async () => JSON.parse(await execute('plutil', ['-convert', 'json', '-o', '-', plist]))
  if (action === 'status') {
    try { return (await execute('launchctl', ['print', target])).split('\n').filter(line => /state =|pid =|last exit code|program =/.test(line)).join('\n') }
    catch { throw new Error('Finplot 守护进程未运行。') }
  }
  if (!['install', 'start', 'stop', 'uninstall'].includes(action)) throw new Error('支持 install / start / stop / status / uninstall。')
  const release = await acquireLaunchLock(dataDir, { scope: 'service' })
  try {
    let previous
    try { previous = await load() } catch (error) { if (action === 'start') throw new Error('请先执行 npm run daemon:install 安装守护进程。', { cause: error }) }
    const oldData = resolve(previous?.EnvironmentVariables?.FINPLOT_DATA_DIR || dataDir)
    if (action === 'stop' || action === 'uninstall') {
      await retireInstance(oldData, [root, previous?.WorkingDirectory].filter(Boolean))
      await bootout()
      if (action === 'uninstall') await rm(plist, { force: true })
      return action === 'stop' ? 'Finplot 已停止。' : '已移除守护进程，账本与备份保留。'
    }
    const environment = { PATH: `${dirname(node)}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
      FINPLOT_DATA_DIR: dataDir, FINPLOT_HOST: env.FINPLOT_HOST || 'auto', FINPLOT_PORT: env.FINPLOT_PORT || '3210',
      ...(env.FINPLOT_TAILSCALE ? { FINPLOT_TAILSCALE: env.FINPLOT_TAILSCALE } : {}) }
    const config = action === 'start' ? { ...previous } : {
      Label: serviceLabel, ProgramArguments: [node, join(root, 'server/start.mjs')], WorkingDirectory: root,
      EnvironmentVariables: environment, RunAtLoad: true, ThrottleInterval: 10, ExitTimeOut: 20,
      StandardOutPath: join(dataDir, 'logs/service.log'), StandardErrorPath: join(dataDir, 'logs/error.log'),
    }
    config.ProgramArguments = [...config.ProgramArguments.filter(arg => arg !== '--replace-existing'), '--replace-existing']
    // A clean handoff must not bring the retired supervisor back. Crashes still restart.
    config.KeepAlive = { SuccessfulExit: false }
    await configureNetwork(config.EnvironmentVariables)
    const build = await readJson(join(config.WorkingDirectory, 'dist/version.json'))
    const pkg = await readJson(join(config.WorkingDirectory, 'package.json'))
    if (!pkg || build?.version !== pkg.version) throw new Error('请先运行 npm run build，当前构建不可用；原服务保持运行。')
    try {
      await readFile(join(config.WorkingDirectory, 'dist/index.html'))
      await readFile(join(config.WorkingDirectory, 'server/worker.mjs'))
    } catch (error) { throw new Error('当前安装缺少页面或服务文件，原服务保持运行。', { cause: error }) }
    await mkdir(dirname(plist), { recursive: true })
    await mkdir(dirname(config.StandardOutPath), { recursive: true, mode: 0o700 })
    const temporary = `${plist}.${randomUUID()}.tmp`
    try {
      await writeFile(temporary, renderPlist(config), { mode: 0o600 })
      await execute('plutil', ['-lint', temporary])
      await retireInstance(oldData, [root, previous?.WorkingDirectory].filter(Boolean))
      await bootout()
      await rename(temporary, plist)
      await execute('launchctl', ['bootstrap', domain, plist])
      await waitForReady({ dataDir: config.EnvironmentVariables.FINPLOT_DATA_DIR || dataDir, target, execute })
    } finally { await rm(temporary, { force: true }) }
    return action === 'install' ? `已安装并启动 Finplot 守护进程。\n${plist}` : 'Finplot 已重新启动，旧实例已替换。'
  } finally { await release() }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(await manageService(process.argv[2] || 'status')) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
