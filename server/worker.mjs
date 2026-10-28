import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createLedgerStore } from './ledger.mjs'
import { createHandler, listen } from './http.mjs'
import { DATA_DIR, ROOT, manifest, httpError } from './common.mjs'

if (!process.send) throw new Error('请通过 npm start 启动受管服务。')
const config = JSON.parse(process.env.FINPLOT_NETWORK)
const instance = process.env.FINPLOT_INSTANCE
const build = JSON.parse(await readFile(new URL('../dist/version.json', import.meta.url), 'utf8'))
if (build.version !== manifest.version) throw new Error('构建版本不一致，请先运行 npm run build。')
const pending = new Map()
process.on('message', message => {
  const request = pending.get(message.id)
  if (!request) return
  pending.delete(message.id); clearTimeout(request.timer)
  if (message.error) request.reject(httpError(message.status || 500, message.error))
  else request.resolve(message.result)
})
function update(action, version) {
  return new Promise((resolve, reject) => {
    const id = randomUUID()
    const timer = setTimeout(() => { pending.delete(id); reject(httpError(504, '更新服务响应超时，请重试。')) }, 40_000)
    pending.set(id, { resolve, reject, timer })
    process.send({ id, action, version })
  })
}
const ledger = await createLedgerStore(DATA_DIR)
const close = await listen(createHandler({ root: ROOT, version: manifest.version, instance, ledger,
  ...config, urls: config.hosts.map(host => `http://${host}:${config.port}`), update }), config.hosts, config.port)
process.send({ ready: true, instance })
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  const timer = setTimeout(() => process.exit(1), 10_000); timer.unref()
  await close(); process.exit(0)
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
process.on('disconnect', stop)
