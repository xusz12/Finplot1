import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, cp, symlink, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { ROOT, run, atomicJson } from '../server/common.mjs'
import { manageService } from '../scripts/service.mjs'

test('真实 macOS 临时后台任务：前台转后台、重复启动及正常交接后不重新抢占端口', { skip: process.platform !== 'darwin', timeout: 90_000 }, async t => {
  const domain = `gui/${process.getuid()}`
  try { await run('launchctl', ['print', domain]) } catch { t.skip('当前环境没有 GUI launchd 域。'); return }
  const dir = await mkdtemp(join(tmpdir(), 'finplot-agent-')), root = join(dir, 'app'), data = join(dir, 'data')
  const serviceLabel = `com.finplot.test.${randomUUID()}`, target = `${domain}/${serviceLabel}`, foreground = []
  t.after(async () => {
    try { await run('launchctl', ['bootout', target]) } catch { /* Already unloaded. */ }
    for (const child of foreground) if (child.exitCode === null && child.signalCode === null) {
      await new Promise(resolve => {
        const timer = setTimeout(() => child.kill('SIGKILL'), 10_000)
        child.once('exit', () => { clearTimeout(timer); resolve() }); child.kill('SIGTERM')
      })
    }
    await rm(dir, { recursive: true, force: true })
  })
  await mkdir(root)
  await cp(join(ROOT, 'server'), join(root, 'server'), { recursive: true })
  await mkdir(join(root, 'src/lib'), { recursive: true })
  await cp(join(ROOT, 'src/lib/ledger.js'), join(root, 'src/lib/ledger.js'))
  await symlink(join(ROOT, 'node_modules'), join(root, 'node_modules'))
  await mkdir(join(root, 'dist'))
  await writeFile(join(root, 'dist/index.html'), '<html><div id="root"></div></html>')
  await atomicJson(join(root, 'dist/version.json'), { version: '1.0.0' })
  await atomicJson(join(root, 'package.json'), { type: 'module', version: '1.0.0', repository: { url: root } })
  const probe = createServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  const env = { ...process.env, FINPLOT_HOST: '127.0.0.1', FINPLOT_PORT: String(port), FINPLOT_DATA_DIR: data }
  const options = { root, dataDir: data, home: dir, serviceLabel, env }
  const health = async () => (await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) })).json()
  const startForeground = async () => {
    const child = spawn(process.execPath, ['server/start.mjs', '--replace-existing'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
    foreground.push(child)
    let logs = ''
    child.stdout.on('data', bytes => { logs += bytes }); child.stderr.on('data', bytes => { logs += bytes })
    const deadline = Date.now() + 20_000
    while (!logs.includes('Finplot v1.0.0')) {
      if (child.exitCode !== null || Date.now() > deadline) throw new Error(logs || '前台启动超时')
      await delay(100)
    }
    return child
  }
  const original = await startForeground(), before = await health()
  await manageService('install', options)
  assert.equal(original.exitCode, 0)
  let previous = await health()
  assert.notEqual(previous.instance, before.instance)
  for (let i = 0; i < 2; i++) {
    await manageService('start', options)
    const next = await health()
    assert.notEqual(next.instance, previous.instance)
    assert.throws(() => process.kill(previous.pid, 0), { code: 'ESRCH' })
    previous = next
  }
  await startForeground()
  const handedOff = await health()
  assert.notEqual(handedOff.instance, previous.instance)
  // Cross launchd's configured ten-second throttle window to catch respawning.
  await delay(11_000)
  assert.deepEqual(await health(), handedOff)
  assert.doesNotMatch(await run('launchctl', ['print', target]), /\bpid = \d+/)
  await manageService('stop', options)
  await assert.rejects(health())
})
