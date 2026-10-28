import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, readFile, cp, symlink, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { ROOT, run } from '../server/common.mjs'
import { fixture } from './helpers/ledger-fixture.mjs'

async function until(read, predicate, timeout = 25_000) {
  const deadline = Date.now() + timeout
  let value
  while (Date.now() < deadline) {
    try { value = await read(); if (predicate(value)) return value } catch { /* Restart gap. */ }
    await delay(100)
  }
  throw new Error(`等待服务超时：${JSON.stringify(value)}`)
}
async function freePort() {
  const socket = createServer()
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
  const port = socket.address().port
  await new Promise(resolve => socket.close(resolve))
  return port
}
test('真实更新链路：进程守护、安装后持久化、启动失败恢复及构建失败不中断账本', { timeout: 90_000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'finplot-launcher-'))
  const repo = join(dir, 'source'), installed = join(dir, 'installed'), data = join(dir, 'data'), releaseUpdate = join(dir, 'release-update')
  let launcher
  const launchers = []
  const stop = async (target = launcher) => {
    if (!target || target.exitCode !== null || target.signalCode !== null) return
    await new Promise(resolve => {
      const timer = setTimeout(() => target.kill('SIGKILL'), 15_000)
      target.once('exit', () => { clearTimeout(timer); resolve() }); target.kill('SIGTERM')
    })
  }
  t.after(async () => { await writeFile(releaseUpdate, ''); await Promise.all(launchers.map(stop)); await rm(dir, { recursive: true, force: true }) })
  await mkdir(repo)
  await cp(join(ROOT, 'server'), join(repo, 'server'), { recursive: true })
  await mkdir(join(repo, 'src/lib'), { recursive: true })
  await cp(join(ROOT, 'src/lib/ledger.js'), join(repo, 'src/lib/ledger.js'))
  await symlink(join(ROOT, 'node_modules'), join(repo, 'node_modules'))
  const originalLock = JSON.parse(await readFile(join(ROOT, 'package-lock.json')))
  const sqlVersion = originalLock.packages[''].dependencies['sql.js']
  const buildScript = `import {mkdir,readFile,writeFile} from 'node:fs/promises';
const pkg=JSON.parse(await readFile('package.json')); await mkdir('dist',{recursive:true});
await writeFile('dist/version.json',JSON.stringify({version:pkg.version}));
await writeFile('dist/index.html','<html><div id="root"></div></html>');`
  await writeFile(join(repo, 'build.mjs'), buildScript)
  await writeFile(join(repo, '.gitignore'), 'node_modules\ndist\nnotes.txt\n')
  const publish = async version => {
    const pkg = { name: 'finplot-test', version, type: 'module', private: true, repository: { url: repo }, scripts: { build: 'node build.mjs' }, dependencies: { 'sql.js': sqlVersion } }
    await writeFile(join(repo, 'package.json'), JSON.stringify(pkg))
    await writeFile(join(repo, 'package-lock.json'), JSON.stringify({ name: pkg.name, version, lockfileVersion: 3, requires: true,
      packages: { '': { name: pkg.name, version, dependencies: pkg.dependencies }, 'node_modules/sql.js': originalLock.packages['node_modules/sql.js'] } }))
    await run('git', ['add', '.'], { cwd: repo })
    await run('git', ['commit', '-m', `test: 发布测试版本 ${version}`], { cwd: repo })
    await run('git', ['tag', '-a', `v${version}`, '-m', `测试版本 ${version}`], { cwd: repo })
  }
  await run('git', ['init', '-q', repo])
  await run('git', ['config', 'user.name', 'Finplot Test'], { cwd: repo })
  await run('git', ['config', 'user.email', 'test@example.invalid'], { cwd: repo })
  await publish('1.0.0')
  await run(process.execPath, ['build.mjs'], { cwd: repo })
  // The installed launcher stays at 1.0.0 while the independent update source evolves.
  await mkdir(installed)
  for (const name of ['server', 'src', 'dist', 'package.json']) await cp(join(repo, name), join(installed, name), { recursive: true })
  await symlink(join(ROOT, 'node_modules'), join(installed, 'node_modules'))
  await writeFile(join(repo, 'notes.txt'), '用户未提交的文件')
  const port = await freePort(), base = `http://127.0.0.1:${port}`
  const env = { ...process.env, FINPLOT_HOST: '127.0.0.1', FINPLOT_PORT: String(port), FINPLOT_DATA_DIR: data }
  let logs = ''
  const start = (replace = false) => {
    launcher = spawn(process.execPath, ['server/start.mjs', ...(replace ? ['--replace-existing'] : [])], { cwd: installed, env, stdio: ['ignore', 'pipe', 'pipe'] })
    launchers.push(launcher)
    launcher.stdout.on('data', bytes => { logs += bytes }); launcher.stderr.on('data', bytes => { logs += bytes })
  }
  t.after(() => { if (t.passed === false) console.error(logs) })
  start()
  const get = async path => (await fetch(base + path, { signal: AbortSignal.timeout(1500) })).json()
  await until(() => get('/api/health'), value => value.version === '1.0.0')
  const post = async (path, payload) => {
    const { token } = await get('/api/status')
    const response = await fetch(base + path, { method: 'POST', headers: { 'X-Finplot-Session': token, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    assert.ok(response.ok, await response.clone().text()); return response.json()
  }
  const { token } = await get('/api/status')
  const upload = await fetch(base + '/api/ledger', { method: 'PUT', headers: { 'X-Finplot-Session': token, 'If-Match': 'empty', 'X-Filename': 'test.sqlite3' }, body: fixture() })
  assert.equal(upload.status, 200)
  const original = await upload.json()
  const beforeCrash = await get('/api/health')
  process.kill(beforeCrash.pid, 'SIGKILL')
  await until(() => get('/api/health'), value => value.instance !== beforeCrash.instance && value.version === '1.0.0')
  assert.deepEqual(await get('/api/ledger'), original)
  // A second launcher must not acquire or kill the service, even with another port.
  await assert.rejects(run(process.execPath, ['server/launcher.mjs'], { cwd: repo, env: { ...env, FINPLOT_PORT: String(await freePort()) } }), /已经运行/)
  assert.deepEqual(await get('/api/ledger'), original)
  // Hold a real update build open while another launcher requests replacement.
  await writeFile(join(repo, 'build.mjs'), `import {existsSync} from 'node:fs'; import {setTimeout as delay} from 'node:timers/promises';
while(!existsSync(${JSON.stringify(releaseUpdate)})) await delay(50);\n${buildScript}`)
  await publish('1.0.1')
  await post('/api/updates/check', {})
  const oldLauncher = launcher, beforeHandoff = await get('/api/health')
  await post('/api/updates/install', { version: '1.0.1' })
  start(true)
  await until(() => logs, value => value.includes('正在等待旧 Finplot 实例'))
  assert.equal(oldLauncher.exitCode, null)
  assert.deepEqual(await get('/api/health'), beforeHandoff)
  await writeFile(releaseUpdate, '')
  await until(() => oldLauncher.exitCode, value => value === 0)
  await until(() => logs, value => value.includes('Finplot v1.0.1'))
  await until(() => get('/api/updates'), value => value.currentVersion === '1.0.1' && value.phase === 'idle')
  assert.equal((await get('/api/health')).version, '1.0.1')
  assert.deepEqual(await get('/api/ledger'), original)
  assert.equal(await readFile(join(repo, 'notes.txt'), 'utf8'), '用户未提交的文件')
  assert.equal(await run('git', ['status', '--porcelain'], { cwd: repo }), '')
  // Restarting the original launcher must select the installed release.
  await stop(); start()
  await until(() => get('/api/health'), value => value.version === '1.0.1')
  const workerSource = await readFile(join(repo, 'server/worker.mjs'), 'utf8')
  await writeFile(join(repo, 'server/worker.mjs'), "throw new Error('模拟新版服务启动失败')\n")
  await publish('1.0.2')
  await post('/api/updates/check', {})
  await post('/api/updates/install', { version: '1.0.2' })
  await until(() => get('/api/updates'), value => value.phase === 'error')
  assert.equal((await get('/api/health')).version, '1.0.1')
  assert.deepEqual(await get('/api/ledger'), original)
  assert.equal(JSON.parse(await readFile(join(data, 'active.json'))).version, '1.0.1')
  await writeFile(join(repo, 'server/worker.mjs'), workerSource)
  await writeFile(join(repo, 'build.mjs'), "throw new Error('模拟构建失败')\n")
  await publish('1.0.3')
  const healthy = await get('/api/health')
  await post('/api/updates/check', {})
  await post('/api/updates/install', { version: '1.0.3' })
  await until(() => get('/api/updates'), value => value.phase === 'error')
  assert.deepEqual(await get('/api/health'), healthy)
  assert.deepEqual(await get('/api/ledger'), original)
})
