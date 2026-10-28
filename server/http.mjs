import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { randomBytes } from 'node:crypto'
import { MAX_LEDGER_BYTES } from '../src/lib/ledger.js'
import { httpError } from './common.mjs'

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' }
function json(res, status, body) { res.writeHead(status, { 'Content-Type': mime['.json'] }); res.end(JSON.stringify(body)) }
async function bodyBytes(req, limit) {
  if (Number(req.headers['content-length']) > limit) throw httpError(413, '文件超过大小限制。')
  const chunks = []; let length = 0
  for await (const chunk of req) {
    length += chunk.length
    if (length > limit) throw httpError(413, '文件超过大小限制。')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}
export function createHandler({ root, version, instance, ledger, hosts, port, urls, update, managed = true }) {
  const token = randomBytes(32).toString('hex')
  const allowedHosts = new Set([...hosts, 'localhost'].map(host => `${host}:${port}`))
  const dist = resolve(root, 'dist')
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'same-origin')
    res.setHeader('X-Frame-Options', 'DENY')
    try {
      if (!allowedHosts.has(req.headers.host)) throw httpError(403, '请通过本机或 Tailscale 地址访问。')
      const origin = `http://${req.headers.host}`
      if (req.headers.origin && req.headers.origin !== origin) throw httpError(403, '不允许跨站请求。')
      const url = new URL(req.url, origin)
      const path = url.pathname
      if (path.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-finplot-session'] !== token) throw httpError(403, '页面连接已过期，请刷新后重试。')
        if (req.method === 'GET' && path === '/api/health') return json(res, 200, { ok: true, version, instance, pid: process.pid })
        if (req.method === 'GET' && path === '/api/status') return json(res, 200, { version, managed, urls, token })
        if (path === '/api/ledger') {
          if (req.method === 'GET') {
            const snapshot = ledger.snapshot()
            if (url.searchParams.get('revision') === snapshot.revision) { res.writeHead(204); return res.end() }
            return json(res, 200, snapshot)
          }
          if (req.method === 'PUT') {
            let filename
            try { filename = decodeURIComponent(req.headers['x-filename'] || 'ledger.sqlite3').replace(/[/\\]/g, '_').slice(0, 255) }
            catch { throw httpError(400, '文件名编码无效。') }
            if (!/\.(sqlite3?|db)$/i.test(filename)) throw httpError(400, '请选择 SQLite 数据库。')
            const bytes = await bodyBytes(req, MAX_LEDGER_BYTES)
            let result
            try { result = await ledger.replace(bytes, filename, req.headers['if-match']) }
            catch (error) { throw error.status ? error : httpError(400, error.message) }
            return json(res, 200, result)
          }
          if (req.method === 'DELETE') return json(res, 200, await ledger.replace(null, null, req.headers['if-match']))
        }
        if (path === '/api/updates' && req.method === 'GET') return json(res, 200, await update('state'))
        if (path === '/api/updates/check' && req.method === 'POST') return json(res, 200, await update('check'))
        if (path === '/api/updates/install' && req.method === 'POST') {
          let payload
          try { payload = JSON.parse((await bodyBytes(req, 4096)).toString()) }
          catch { throw httpError(400, '更新请求格式不正确。') }
          return json(res, 202, await update('install', payload.version))
        }
        throw httpError(404, '接口不存在。')
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw httpError(405, '不支持此操作。')
      const file = resolve(dist, `.${decodeURIComponent(path === '/' ? '/index.html' : path)}`)
      if (!file.startsWith(dist + sep) || !mime[extname(file)]) throw httpError(404, '页面不存在。')
      let bytes
      try { if (!(await stat(file)).isFile()) throw new Error(); bytes = await readFile(file) }
      catch { throw httpError(404, '页面不存在。') }
      res.setHeader('Content-Type', mime[extname(file)])
      if (path.startsWith('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : bytes)
    } catch (error) {
      if (!res.headersSent && !res.destroyed) json(res, error.status || 500, { error: error.status ? error.message : '服务暂时不可用，请查看服务日志。' })
      if (!error.status) console.error(error)
    }
  }
}
export async function listen(handler, hosts, port) {
  const servers = []
  try {
    for (const host of hosts) {
      const server = createServer(handler)
      server.requestTimeout = 120_000
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve) })
      servers.push(server)
    }
  } catch (error) { for (const server of servers) server.close(); throw error }
  return async () => Promise.all(servers.map(server => new Promise(resolve => { server.close(resolve); server.closeIdleConnections() })))
}
