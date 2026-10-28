import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, readFile, cp, symlink, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { ROOT, atomicJson, run } from '../server/common.mjs'
import { instancePaths, acquireLaunchLock, createInstance, retireExisting, requestControl } from '../server/instance.mjs'
import { manageService, waitForService } from '../scripts/service.mjs'
import { fixture } from './helpers/ledger-fixture.mjs'

async function until(read, predicate, timeout = 20_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try { const value = await read(); if (predicate(value)) return value } catch { /* Handoff gap. */ }
    await delay(50)
  }
  throw new Error('等待进程状态超时。')
}
const running = child => child.exitCode === null && child.signalCode === null
async function stop(child) {
  if (running(child)) await new Promise(resolve => {
    const timeout = setTimeout(() => child.kill('SIGKILL'), 10_000)
    child.once('exit', () => { clearTimeout(timeout); resolve() }); child.kill('SIGTERM')
  })
}
async function temporary(t) {
  const dir = await mkdtemp(join(tmpdir(), 'finplot-replacement-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}
async function project(t) {
  const dir = await mkdtemp(join(tmpdir(), 'finplot-replacement-')), repo = join(dir, 'source'), data = join(dir, 'data')
  const children = []
  t.after(async () => { await Promise.all(children.map(stop)); await rm(dir, { recursive: true, force: true }) })
  await mkdir(repo)
  await cp(join(ROOT, 'server'), join(repo, 'server'), { recursive: true })
  await mkdir(join(repo, 'src/lib'), { recursive: true })
  await cp(join(ROOT, 'src/lib/ledger.js'), join(repo, 'src/lib/ledger.js'))
  await symlink(join(ROOT, 'node_modules'), join(repo, 'node_modules'))
  await mkdir(join(repo, 'dist'))
  await writeFile(join(repo, 'dist/index.html'), '<html><div id="root"></div></html>')
  await writeFile(join(repo, 'dist/version.json'), JSON.stringify({ version: '1.0.0' }))
  await writeFile(join(repo, 'package.json'), JSON.stringify({ version: '1.0.0', type: 'module', repository: { url: repo } }))
  const probe = createServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  const base = `http://127.0.0.1:${port}`
  const start = (replace = true) => {
    const child = spawn(process.execPath, ['server/start.mjs', ...(replace ? ['--replace-existing'] : [])], {
      cwd: repo, env: { ...process.env, FINPLOT_HOST: '127.0.0.1', FINPLOT_PORT: String(port), FINPLOT_DATA_DIR: data }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.logs = ''
    child.stdout.on('data', bytes => { child.logs += bytes }); child.stderr.on('data', bytes => { child.logs += bytes })
    children.push(child)
    return child
  }
  const get = async (path = '/api/health') => (await fetch(base + path, { signal: AbortSignal.timeout(1000) })).json()
  const ready = async child => {
    await until(() => child.logs, logs => logs.includes('Finplot v1.0.0'))
    return get()
  }
  return { repo, data, base, port, start, get, ready }
}

test('重复启动替换旧守护进程及工作进程，并保留共享账本', { timeout: 30_000 }, async t => {
  const p = await project(t), old = p.start()
  const before = await p.ready(old), { token } = await p.get('/api/status')
  const upload = await fetch(p.base + '/api/ledger', { method: 'PUT', headers: { 'X-Finplot-Session': token, 'If-Match': 'empty', 'X-Filename': 'test.sqlite3' }, body: fixture() })
  assert.equal(upload.status, 200)
  const ledger = await upload.json(), next = p.start()
  const after = await p.ready(next)
  await until(() => old.exitCode, code => code === 0)
  assert.notEqual(after.pid, before.pid)
  assert.notEqual(after.instance, before.instance)
  assert.deepEqual(await p.get('/api/ledger'), ledger)
  assert.throws(() => process.kill(before.pid, 0), { code: 'ESRCH' })
})

test('同时启动的接管请求串行完成，最终只有一个实例', { timeout: 30_000 }, async t => {
  const p = await project(t), old = p.start()
  await p.ready(old)
  const replacements = [p.start(), p.start()]
  await Promise.all(replacements.map(child => until(() => child.logs, logs => logs.includes('Finplot v1.0.0'))))
  await until(() => replacements.filter(running).length, count => count === 1)
  await until(() => old.exitCode, code => code === 0)
  assert.equal(replacements.find(child => !running(child)).exitCode, 0)
  assert.ok((await p.get()).instance)
})

test('令牌校验失败保留旧实例，失败启动不删除旧锁', { timeout: 30_000 }, async t => {
  const p = await project(t), old = p.start()
  const before = await p.ready(old), paths = instancePaths(p.data)
  const owner = JSON.parse(await readFile(paths.owner, 'utf8'))
  const status = await requestControl(paths.socket, { action: 'status', token: owner.token })
  assert.equal(status.ready, true)
  assert.equal(status.pid, old.pid)
  assert.equal(status.workerPid, before.pid)
  const denied = await requestControl(paths.socket, { action: 'shutdown', token: 'wrong' })
  assert.equal(denied.error, 'unauthorized')
  await atomicJson(paths.owner, { ...owner, token: 'stale' })
  const next = p.start()
  await until(() => next.exitCode, code => code === 1)
  assert.deepEqual(await p.get(), before)
  assert.ok(running(old))
  assert.match(next.logs, /身份验证/)
  await atomicJson(paths.owner, owner)
})

test('旧实例忙碌时等待，超时不会留下延迟停止请求', async t => {
  const data = await temporary(t)
  await mkdir(join(data, 'runtime'))
  let busy = true, stopped = false
  const control = await createInstance({ dataDir: data, root: ROOT, onShutdown: () => {
    if (busy) return { ok: false, status: 'waiting' }
    stopped = true; setImmediate(() => void control.close()); return { ok: true }
  } })
  t.after(() => control.close())
  await assert.rejects(retireExisting(data, { timeout: 200 }), /未能安全退出/)
  assert.equal(stopped, false)
  busy = false
  await delay(100)
  assert.equal(stopped, false)
  await retireExisting(data)
  assert.equal(stopped, true)
})

test('升级前的旧版启动器也能被核验并替换', { timeout: 30_000, skip: process.platform !== 'darwin' }, async t => {
  const p = await project(t), path = join(p.repo, 'server/launcher.mjs')
  const current = await readFile(path, 'utf8')
  await writeFile(path, `import {createServer} from 'node:net'; import {fork} from 'node:child_process';
import {mkdir} from 'node:fs/promises'; import {join} from 'node:path';
import {DATA_DIR,ROOT,atomicJson,networkConfig} from './common.mjs'; import {instancePaths} from './instance.mjs';
await mkdir(DATA_DIR,{recursive:true}); const config=await networkConfig();
const socket=createServer(client=>client.end()); await new Promise(resolve=>socket.listen(instancePaths(DATA_DIR).socket,resolve));
const child=fork(join(ROOT,'server/worker.mjs'),[],{env:{...process.env,FINPLOT_NETWORK:JSON.stringify(config),FINPLOT_INSTANCE:'legacy'}});
await new Promise(resolve=>child.on('message',message=>{if(message.ready)resolve()}));
await atomicJson(join(DATA_DIR,'active.json'),{root:ROOT,version:'1.0.0'}); console.log('Finplot v1.0.0');
process.on('SIGTERM',()=>{child.once('exit',()=>socket.close(()=>process.exit(0)));child.kill('SIGTERM')});`)
  const old = p.start(false), before = await p.ready(old)
  await writeFile(path, current)
  const next = p.start(), after = await p.ready(next)
  await until(() => old.exitCode, code => code === 0)
  assert.notEqual(after.pid, before.pid)
  assert.notEqual(after.instance, before.instance)
})

test('其他程序占用端口时明确失败，不结束占用进程', { timeout: 30_000 }, async t => {
  const p = await project(t)
  const occupant = createServer((request, response) => response.end('another application'))
  await new Promise(resolve => occupant.listen(p.port, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => occupant.close(resolve)))
  const next = p.start()
  await until(() => next.exitCode, code => code === 1)
  assert.equal(await (await fetch(p.base)).text(), 'another application')
  assert.match(next.logs, /EADDRINUSE/)
})

test('中断遗留的启动锁可以恢复，释放旧锁不影响后继锁', async t => {
  const data = await temporary(t), path = instancePaths(data).launch
  const dead = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' })
  await new Promise(resolve => dead.once('exit', resolve))
  await mkdir(path, { recursive: true })
  await writeFile(join(path, 'owner-abandoned.json'), JSON.stringify({ pid: dead.pid }))
  const release = await acquireLaunchLock(data, { timeout: 1000 })
  await release()
  const successor = await acquireLaunchLock(data)
  await release()
  await assert.rejects(acquireLaunchLock(data, { timeout: 100 }), /另一个启动请求/)
  await successor()
})

test('daemon:start 重复启动先交接旧实例再重载，保存原端口和仅异常拉起策略', async t => {
  const dir = await temporary(t), root = join(dir, 'project'), data = join(dir, 'data')
  await mkdir(join(root, 'dist'), { recursive: true })
  await atomicJson(join(root, 'package.json'), { version: '1.0.0' })
  await atomicJson(join(root, 'dist/version.json'), { version: '1.0.0' })
  await writeFile(join(root, 'dist/index.html'), '<div id="root"></div>')
  await mkdir(join(root, 'server'))
  await writeFile(join(root, 'server/worker.mjs'), '')
  const previous = { Label: 'com.finplot.service', ProgramArguments: [process.execPath, join(root, 'server/start.mjs')], WorkingDirectory: root,
    EnvironmentVariables: { FINPLOT_DATA_DIR: data, FINPLOT_HOST: '127.0.0.1', FINPLOT_PORT: '4321' }, KeepAlive: true,
    RunAtLoad: true, StandardOutPath: join(data, 'logs/service.log'), StandardErrorPath: join(data, 'logs/error.log') }
  const actions = [], configurations = []
  const options = { home: dir, uid: 501, root, dataDir: data, platform: 'darwin',
    waitForReady: async ({ dataDir }) => { assert.equal(dataDir, data); actions.push('healthy') },
    configureNetwork: async config => configurations.push(config),
    retireInstance: async selected => { assert.equal(selected, data); actions.push('retire') },
    execute: async (command, args) => {
      if (command === 'plutil' && args[0] === '-convert') return JSON.stringify(previous)
      actions.push(`${command}:${args[0]}`)
      return ''
    },
  }
  await manageService('start', options)
  await manageService('start', options)
  assert.deepEqual(actions, ['plutil:-lint', 'retire', 'launchctl:bootout', 'launchctl:bootstrap', 'healthy', 'plutil:-lint', 'retire', 'launchctl:bootout', 'launchctl:bootstrap', 'healthy'])
  assert.equal(configurations[1].FINPLOT_PORT, '4321')
  const plist = join(dir, 'Library/LaunchAgents/com.finplot.service.plist'), content = await readFile(plist, 'utf8')
  assert.match(content, /<string>--replace-existing<\/string>/)
  assert.match(content, /<key>KeepAlive<\/key><dict><key>SuccessfulExit<\/key><false\/><\/dict>/)
  if (process.platform === 'darwin') await run('plutil', ['-lint', plist])
  await atomicJson(join(root, 'dist/version.json'), { version: '0.9.0' })
  actions.length = 0
  await assert.rejects(manageService('start', options), /原服务保持运行/)
  assert.deepEqual(actions, [])
  assert.equal(await readFile(plist, 'utf8'), content)
  await atomicJson(join(root, 'dist/version.json'), { version: '1.0.0' })
  await rm(join(root, 'dist/index.html'))
  await assert.rejects(manageService('start', options), /原服务保持运行/)
  assert.deepEqual(actions, [])
})

test('后台启动成功须匹配 launchd 的进程身份与就绪状态', async t => {
  const data = await temporary(t)
  let ready = false, pid = process.pid
  const control = await createInstance({ dataDir: data, root: ROOT, onShutdown: () => ({ ok: false }), onStatus: () => ({ ready, pid }) })
  t.after(() => control.close())
  const options = { dataDir: data, target: 'test-job', timeout: 100, execute: async () => `pid = ${process.pid}` }
  await assert.rejects(waitForService(options), /健康检查未通过/)
  ready = true; pid += 1
  await assert.rejects(waitForService(options), /健康检查未通过/)
  pid = process.pid
  await waitForService(options)
})
