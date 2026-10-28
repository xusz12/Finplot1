import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, rm, readFile, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, request as httpRequest } from 'node:http'
import { createLedgerStore } from '../server/ledger.mjs'
import { createHandler } from '../server/http.mjs'
import { isTailscaleIPv4, networkConfig } from '../server/common.mjs'
import { compareVersions, stableReleases, createUpdater, prepareRelease } from '../server/updates.mjs'
import { fixture } from './helpers/ledger-fixture.mjs'

async function temporary(t) {
  const dir = await mkdtemp(join(tmpdir(), 'finplot-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}
test('共享账本跨服务重启恢复，失败和过期写入保留当前账本，移除保留历史快照', async t => {
  const dir = await temporary(t)
  const store = await createLedgerStore(dir)
  assert.equal(store.snapshot().ledger, null)
  const first = await store.replace(fixture(), '合成账本.sqlite3', 'empty')
  assert.equal(first.ledger.transactions.length, 8)
  const restored = await createLedgerStore(dir)
  assert.deepEqual(restored.snapshot(), first)
  await assert.rejects(store.replace(Buffer.from('invalid'), 'broken.db', first.revision), /SQLite/)
  assert.deepEqual(store.snapshot(), first)
  await assert.rejects(store.replace(fixture(), 'old.db', 'empty'), { status: 409 })
  const results = await Promise.allSettled([store.replace(fixture(), '新账本.db', first.revision), store.replace(fixture(), '并发.db', first.revision)])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  const second = store.snapshot()
  await store.replace(null, null, second.revision)
  assert.equal((await createLedgerStore(dir)).snapshot().ledger, null)
  assert.ok((await readdir(join(dir, 'ledger'))).includes(`${first.revision}.sqlite3`))
  assert.deepEqual(await readFile(join(dir, 'ledger', `${first.revision}.sqlite3`)), Buffer.from(fixture()))
})

test('服务 API 共享账本、限制跨站与伪造 Host、阻止无令牌写入和路径越界', async t => {
  const dir = await temporary(t)
  await mkdir(join(dir, 'dist'))
  await writeFile(join(dir, 'dist/index.html'), '<div id="root"></div>')
  await writeFile(join(dir, 'private.json'), '{"secret":true}')
  const ledger = await createLedgerStore(dir)
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }))
  const port = server.address().port, base = `http://127.0.0.1:${port}`
  server.on('request', createHandler({ root: dir, version: '0.1.2', instance: 'test', ledger, hosts: ['127.0.0.1'], port, urls: [base], update: async () => ({ phase: 'idle' }) }))
  const request = (path, options) => fetch(base + path, options)
  assert.equal((await request('/')).status, 200)
  const forgedHostStatus = await new Promise((resolve, reject) => {
    const req = httpRequest(base + '/api/health', { headers: { Host: `evil.test:${port}` } }, res => { res.resume(); resolve(res.statusCode) })
    req.on('error', reject); req.end()
  })
  assert.equal(forgedHostStatus, 403)
  assert.equal((await request('/api/status', { headers: { Origin: 'https://evil.test' } })).status, 403)
  assert.equal((await request('/api/ledger', { method: 'DELETE' })).status, 403)
  assert.equal((await request('/%2e%2e%2fprivate.json')).status, 404)
  assert.equal((await request('/server/common.mjs')).status, 404)
  const { token } = await (await request('/api/status')).json()
  const headers = { 'X-Finplot-Session': token, 'If-Match': 'empty', 'X-Filename': encodeURIComponent('测试.sqlite3') }
  const uploaded = await request('/api/ledger', { method: 'PUT', headers, body: fixture() })
  assert.equal(uploaded.status, 200)
  const first = await uploaded.json()
  const secondDevice = await (await request('/api/ledger')).json()
  assert.deepEqual(secondDevice, first)
  assert.equal((await request(`/api/ledger?revision=${first.revision}`)).status, 204)
  assert.equal((await request('/api/ledger', { method: 'PUT', headers, body: fixture() })).status, 409)
  assert.equal((await request('/api/ledger', { method: 'PUT', headers: { ...headers, 'If-Match': first.revision }, body: 'invalid' })).status, 400)
  assert.equal((await request('/api/updates/install', { method: 'POST', headers, body: '{' })).status, 400)
  const deleted = await request('/api/ledger', { method: 'DELETE', headers: { ...headers, 'If-Match': first.revision } })
  assert.equal(deleted.status, 200)
  assert.equal((await (await request('/api/ledger')).json()).ledger, null)
})

test('监听限制在回环和 Tailscale IPv4，不误接受局域网或通配地址', async () => {
  assert.equal(isTailscaleIPv4('100.64.0.1'), true)
  assert.equal(isTailscaleIPv4('100.127.255.254'), true)
  for (const value of ['100.128.0.1', '100.63.0.1', '192.168.1.1', '0.0.0.0', '100.88.999.1', 'example.com']) assert.equal(isTailscaleIPv4(value), false)
  assert.deepEqual((await networkConfig({ FINPLOT_HOST: '127.0.0.1' })).hosts, ['127.0.0.1'])
  assert.deepEqual((await networkConfig({ FINPLOT_HOST: '100.88.1.2' })).hosts, ['127.0.0.1', '100.88.1.2'])
  await assert.rejects(networkConfig({ FINPLOT_HOST: '0.0.0.0' }), /仅支持/)
  await assert.rejects(networkConfig({ FINPLOT_PORT: '-1' }), /1–65535/)
})

test('稳定标签按数字排序，附注标签使用解引用提交，跳过预发布及伪造标签', () => {
  const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40)
  const releases = stableReleases(`${a}\trefs/tags/v0.9.0\n${b}\trefs/tags/v0.10.0\n${c}\trefs/tags/v0.10.0^{}\n${a}\trefs/tags/v9.0.0-beta\n${a}\trefs/tags/v01.0.0`)
  assert.deepEqual(releases.map(r => r.tag), ['v0.10.0', 'v0.9.0'])
  assert.equal(releases[0].commit, c)
  assert.equal(compareVersions('v0.10.0', '0.9.0'), 1)
  assert.equal(compareVersions('0.1.2', 'v0.1.2'), 0)
})

test('更新检查失败不假报最新；安装互斥，失败保留版本；成功持久化与禁止降级', async t => {
  const dataDir = await temporary(t)
  let fail = false, activationFails = true, releasePrepare, count = 0
  const execute = async () => { if (fail) throw new Error('network offline'); return `${'a'.repeat(40)}\trefs/tags/v0.1.3` }
  const updater = await createUpdater({ repository: 'test', version: '0.1.2', dataDir, execute,
    prepare: async () => { count++; await new Promise(resolve => { releasePrepare = resolve }); return '/candidate' },
    activate: async () => { if (activationFails) throw new Error('health check failed') } })
  fail = true; await updater.check()
  assert.match(updater.snapshot().error, /network offline/)
  assert.equal(updater.snapshot().checkedAt, null)
  fail = false; await updater.check()
  assert.equal(updater.snapshot().available, true)
  await assert.rejects(updater.install('9.9.9'), { status: 409 })
  const first = updater.install('0.1.3')
  await assert.rejects(updater.install('0.1.3'), { status: 409 })
  await first; releasePrepare(); await updater.settled()
  assert.equal(count, 1)
  assert.equal(updater.snapshot().currentVersion, '0.1.2')
  assert.match(updater.snapshot().error, /health check failed/)
  activationFails = false
  await updater.install('0.1.3'); releasePrepare(); await updater.settled()
  assert.equal(updater.snapshot().currentVersion, '0.1.3')
  assert.equal(updater.snapshot().available, false)
  assert.equal(JSON.parse(await readFile(join(dataDir, 'update.json'))).currentVersion, '0.1.3')
  await assert.rejects(updater.install('0.1.3'), { status: 409 })
})

test('标签移动与构建错误清理候选目录，源码和数据保留', async t => {
  const dataDir = await temporary(t)
  await writeFile(join(dataDir, 'personal.txt'), 'keep')
  const release = { tag: 'v0.1.3', version: '0.1.3', commit: 'a'.repeat(40) }
  const execute = async (command, args) => {
    if (args[0] === 'clone') { await mkdir(args.at(-1), { recursive: true }); return '' }
    return 'b'.repeat(40)
  }
  await assert.rejects(prepareRelease({ repository: 'test', release, dataDir, execute }), /标签已变化/)
  assert.deepEqual(await readdir(join(dataDir, 'releases')), [])
  assert.equal(await readFile(join(dataDir, 'personal.txt'), 'utf8'), 'keep')
})
