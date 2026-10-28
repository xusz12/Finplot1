import { mkdir, readFile, rm } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { atomicJson, httpError, readJson, run } from './common.mjs'

export function compareVersions(a, b) {
  const left = a.replace(/^v/, '').split('.').map(Number)
  const right = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1
  return 0
}
export function stableReleases(output) {
  const tags = new Map()
  for (const line of output.split('\n')) {
    const match = line.match(/^([a-f0-9]{40})\s+refs\/tags\/(v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*))(\^\{\})?$/)
    if (!match) continue
    const [, commit, tag] = match
    if (!tags.has(tag) || match[6]) tags.set(tag, { tag, version: tag.slice(1), commit })
  }
  return [...tags.values()].sort((a, b) => compareVersions(b.version, a.version))
}
export async function prepareRelease({ repository, release, dataDir, execute = run }) {
  const directory = join(dataDir, 'releases', `${release.tag}-${randomUUID()}`)
  await mkdir(dirname(directory), { recursive: true, mode: 0o700 })
  try {
    await execute('git', ['clone', '--depth', '1', '--branch', release.tag, '--single-branch', '--', repository, directory], { timeout: 120_000 })
    const commit = await execute('git', ['-C', directory, 'rev-parse', 'HEAD'])
    if (commit !== release.commit) throw new Error('远端标签已变化，请重新检查更新。')
    const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
    if (pkg.version !== release.version || !existsSync(join(directory, 'server/worker.mjs'))) throw new Error('发布版本资料不一致或不支持服务更新。')
    const npm = process.env.npm_execpath
    const npmCommand = npm ? process.execPath : 'npm'
    const prefix = npm ? [npm] : []
    await execute(npmCommand, [...prefix, 'ci', '--no-audit', '--no-fund'], { cwd: directory, timeout: 300_000 })
    await execute(npmCommand, [...prefix, 'run', 'build'], { cwd: directory, timeout: 180_000 })
    const build = JSON.parse(await readFile(join(directory, 'dist/version.json'), 'utf8'))
    if (build.version !== release.version) throw new Error('构建版本不一致。')
    return directory
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error }
}

export async function createUpdater({ repository, version, dataDir, activate, execute = run, prepare = prepareRelease }) {
  const stateFile = join(dataDir, 'update.json')
  const previous = await readJson(stateFile, {})
  let state = { currentVersion: version, latest: null, checkedAt: null, phase: 'idle', error: null, ...previous, currentVersion: version }
  if (['installing', 'checking'].includes(state.phase)) state = { ...state, phase: 'error', error: '上次更新被中断，当前版本仍可使用。' }
  let checking, installing, reserved = false
  const save = async (patch) => { state = { ...state, ...patch }; await atomicJson(stateFile, state); return { ...state } }
  const snapshot = () => ({ ...state, repository, available: Boolean(state.latest && compareVersions(state.latest.version, state.currentVersion) > 0) })
  async function check() {
    if (reserved || installing) return snapshot()
    if (checking) return checking
    checking = (async () => {
      await save({ phase: 'checking', error: null })
      try {
        const output = await execute('git', ['ls-remote', '--tags', repository], { timeout: 30_000 })
        const latest = stableReleases(output)[0] ?? null
        await save({ latest, checkedAt: new Date().toISOString(), phase: 'idle' })
      } catch (error) { await save({ phase: 'error', error: `检查更新失败：${error.message.slice(0, 250)}` }) }
      return snapshot()
    })().finally(() => { checking = null })
    return checking
  }
  async function install(expectedVersion) {
    if (reserved || installing || checking) throw httpError(409, '更新任务正在进行。')
    if (!snapshot().available || state.latest.version !== expectedVersion) throw httpError(409, '请先检查更新并确认目标版本。')
    const release = { ...state.latest }
    reserved = true
    try { await save({ phase: 'installing', error: null }) }
    catch (error) { reserved = false; throw error }
    installing = (async () => {
      try {
        const directory = await prepare({ repository, release, dataDir, execute })
        await activate(directory, release.version)
        await save({ currentVersion: release.version, phase: 'idle', error: null })
      } catch (error) { await save({ phase: 'error', error: `更新失败，已保留原版本：${error.message.slice(0, 250)}` }) }
    })().finally(() => { installing = null; reserved = false })
    return snapshot()
  }
  return { snapshot, check, install, settled: () => installing ?? checking ?? Promise.resolve() }
}
