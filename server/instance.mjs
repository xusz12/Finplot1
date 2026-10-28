import { createServer, createConnection } from 'node:net'
import { mkdir, writeFile, readFile, rename, readdir, unlink, rmdir, chmod, rm } from 'node:fs/promises'
import { join, resolve, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID, createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { atomicJson, readJson, run } from './common.mjs'

export function instancePaths(dataDir) {
  const name = `finplot-${process.getuid?.() ?? 'user'}-${createHash('sha256').update(resolve(dataDir)).digest('hex').slice(0, 16)}`
  return { socket: join(tmpdir(), `${name}.sock`), owner: join(dataDir, 'runtime/owner.json'), launch: join(dataDir, 'runtime/launch.lock') }
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 1) throw new Error('启动锁身份无效，未移除锁。')
  try { process.kill(pid, 0); return true }
  catch (error) { if (error.code === 'ESRCH') return false; throw error }
}
async function removeClaim(directory, filename) {
  await unlink(join(directory, filename)).catch(error => { if (error.code !== 'ENOENT') throw error })
  await rmdir(directory).catch(error => { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error })
}

// Rename a populated directory atomically: it cannot replace another populated
// lock. Cleanup removes only the unique owner's file, never a successor's lock.
export async function acquireLaunchLock(dataDir, { timeout = 90_000, signal, scope = 'launch' } = {}) {
  if (!['launch', 'service'].includes(scope)) throw new Error('无效的启动锁范围。')
  const launch = join(dataDir, 'runtime', `${scope}.lock`)
  const candidate = `${launch}.${randomUUID()}`
  const filename = `owner-${randomUUID()}.json`
  await mkdir(candidate, { recursive: true, mode: 0o700 })
  await writeFile(join(candidate, filename), JSON.stringify({ pid: process.pid }), { mode: 0o600 })
  const deadline = Date.now() + timeout
  try {
    while (true) {
      signal?.throwIfAborted()
      try {
        await rename(candidate, launch)
        let released = false
        return async () => { if (!released) { released = true; await removeClaim(launch, filename) } }
      } catch (error) { if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error }
      try {
        const files = await readdir(launch)
        if (!files.length) await rmdir(launch).catch(error => { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error })
        else if (files.length === 1 && /^owner-[\w-]+\.json$/.test(files[0])) {
          const owner = JSON.parse(await readFile(join(launch, files[0]), 'utf8'))
          if (!alive(owner.pid)) await removeClaim(launch, files[0])
        } else throw new Error('启动锁内容不明，未移除锁。')
      } catch (error) { if (error.code !== 'ENOENT') throw error }
      if (Date.now() >= deadline) throw new Error('另一个启动请求尚未完成，请稍后重试。')
      await delay(100, undefined, { signal })
    }
  } finally { await removeClaim(candidate, filename) }
}

export async function isListening(path) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(path)
    socket.setTimeout(2000, () => { socket.destroy(); reject(new Error('旧实例控制连接超时，未接管。')) })
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', error => {
      socket.destroy()
      if (['ENOENT', 'ECONNREFUSED'].includes(error.code)) resolve(false)
      else reject(error)
    })
  })
}

export async function requestControl(path, request) {
  return new Promise((resolve, reject) => {
    const socket = createConnection(path)
    let buffer = ''
    socket.setEncoding('utf8')
    socket.setTimeout(2500, () => socket.destroy(new Error('旧实例控制请求超时。')))
    socket.once('connect', () => socket.write(JSON.stringify(request) + '\n'))
    socket.on('data', chunk => {
      buffer += chunk
      if (buffer.length > 16_384) socket.destroy(new Error('控制响应过长。'))
    })
    socket.once('error', reject)
    socket.once('end', () => {
      try { resolve(buffer ? JSON.parse(buffer) : null) } catch (error) { reject(error) }
      socket.destroy()
    })
  })
}

// Legacy v0.1.2 has no control protocol. Only accept a Node launcher that owns
// this exact ledger socket AND has a verified project path, UID and start time.
export async function legacyOwner(socketPath, roots) {
  try {
    const output = await run('lsof', ['-nP', '-U', '-Fpn'], { timeout: 3000 })
    const owners = new Set()
    let pid
    for (const line of output.split('\n')) {
      if (/^p\d+$/.test(line)) pid = Number(line.slice(1))
      if (line === `n${socketPath}`) owners.add(pid)
    }
    if (owners.size !== 1) return null
    pid = [...owners][0]
    if (!pid || pid === process.pid || pid <= 1) return null
    const executable = await run('ps', ['-p', String(pid), '-o', 'comm='], { timeout: 2000 })
    if (!/^node(?:js)?$/.test(basename(executable))) return null
    const identity = await run('ps', ['-p', String(pid), '-o', 'uid=,lstart=,command='], { timeout: 2000 })
    if (Number(identity.split(/\s+/)[0]) !== process.getuid?.()) return null
    const cwd = (await run('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { timeout: 2000 })).split('\n').find(line => line.startsWith('n'))?.slice(1)
    const valid = roots.some(root => {
      const scripts = ['server/start.mjs', 'server/launcher.mjs']
      return scripts.some(script => identity.endsWith(` ${join(root, script)}`) || (resolve(cwd || '/') === resolve(root) && identity.endsWith(` ${script}`)))
    })
    return valid ? { pid, identity } : null
  } catch { return null }
}

async function stopLegacy(owner) {
  if (process.platform === 'darwin') {
    const target = `gui/${process.getuid()}/com.finplot.service`
    let job = ''
    try { job = await run('launchctl', ['print', target], { timeout: 2000 }) } catch { /* Foreground launcher. */ }
    if (new RegExp(`\\bpid = ${owner.pid}\\b`).test(job)) {
      // An old KeepAlive=true agent must be unloaded, otherwise it respawns
      // the previous supervisor during handoff. Its plist is preserved.
      await run('launchctl', ['bootout', target], { timeout: 30_000 })
      return
    }
  }
  try { process.kill(owner.pid, 'SIGTERM') } catch (error) { if (error.code !== 'ESRCH') throw error }
}

// Call while holding the launch lock. A busy update is polled without asking
// the old owner to exit later, so a timed-out request leaves it serving normally.
export async function retireExisting(dataDir, { replace = true, roots = [], timeout = 90_000, signal } = {}) {
  const paths = instancePaths(dataDir)
  const deadline = Date.now() + timeout
  let requested = false, announced = false
  while (await isListening(paths.socket)) {
    signal?.throwIfAborted()
    if (!replace) throw new Error('此账本服务已经运行。使用 npm start 可替换旧实例。')
    if (Date.now() >= deadline) throw new Error('旧实例未能安全退出，未启动第二个服务。')
    if (!announced) { console.log('正在等待旧 Finplot 实例退出并接管…'); announced = true }
    if (!requested) {
      const owner = await readJson(paths.owner)
      if (owner?.token && owner.dataDir === resolve(dataDir)) {
        const response = await requestControl(paths.socket, { action: 'shutdown', token: owner.token })
        if (response?.ok) requested = true
        else if (response?.status !== 'waiting') throw new Error('旧实例身份验证或控制请求失败，未强行接管。')
      } else {
        const legacy = await legacyOwner(paths.socket, roots)
        if (!legacy) throw new Error('无法确认旧启动器的身份，未停止其他进程。')
        const update = await readJson(join(dataDir, 'update.json'))
        if (!['installing', 'checking'].includes(update?.phase)) {
          const checked = await legacyOwner(paths.socket, roots)
          if (checked?.pid !== legacy.pid || checked.identity !== legacy.identity) continue
          await stopLegacy(checked)
          requested = true
        }
      }
    }
    await delay(150, undefined, { signal })
  }
}

export async function createInstance({ dataDir, root, onShutdown, onStatus }) {
  const paths = instancePaths(dataDir)
  const token = randomUUID()
  const clients = new Set()
  const server = createServer(socket => {
    clients.add(socket)
    socket.once('close', () => clients.delete(socket))
    socket.on('error', () => {})
    socket.setTimeout(3000, () => socket.destroy())
    socket.setEncoding('utf8')
    let buffer = '', handled = false
    socket.on('data', chunk => {
      if (handled) return
      buffer += chunk
      if (buffer.length > 16_384) { socket.destroy(); return }
      if (!buffer.includes('\n')) return
      handled = true
      let response
      try {
        const request = JSON.parse(buffer.trim())
        response = request.token !== token ? { ok: false, error: 'unauthorized' }
          : request.action === 'shutdown' ? onShutdown()
            : request.action === 'status' && onStatus ? onStatus() : { ok: false, error: 'unsupported_action' }
      } catch { response = { ok: false, error: 'invalid_request' } }
      socket.end(JSON.stringify(response) + '\n')
    })
  })
  // Launch requests are serialized; only remove an unbound socket here.
  if (await isListening(paths.socket)) throw new Error('旧实例尚未退出，未启动第二个服务。')
  await rm(paths.socket, { force: true })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(paths.socket, resolve) })
  const close = async () => {
    const owner = await readJson(paths.owner)
    if (owner?.token === token) await rm(paths.owner, { force: true })
    for (const socket of clients) socket.destroy()
    if (server.listening) await new Promise(resolve => server.close(resolve))
  }
  try {
    await chmod(paths.socket, 0o600)
    await atomicJson(paths.owner, { pid: process.pid, token, root, dataDir: resolve(dataDir) })
    return { close }
  } catch (error) { await close(); throw error }
}
