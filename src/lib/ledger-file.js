import { MAX_LEDGER_BYTES, readLedger } from './ledger.js'

let runtime
async function sqlRuntime() {
  if (!runtime) runtime = Promise.all([
    import('sql.js'), import('sql.js/dist/sql-wasm.wasm?url'),
  ]).then(([{ default: init }, { default: wasmUrl }]) => init({ locateFile: () => wasmUrl }))
    .catch(error => { runtime = null; throw error })
  return runtime
}

export async function importLedgerFile(file) {
  if (file.size > MAX_LEDGER_BYTES) throw new Error('账本超过 100 MB，请选择较小的 SQLite 快照。')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const ledger = readLedger(await sqlRuntime(), bytes, file.name)
  return { ledger, bytes }
}

// Legacy browser storage remains readable for static previews and explicit migration.
async function cacheRequest(mode, action) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('finplot-ledger', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('snapshots')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('snapshots', mode)
      const request = action(transaction.objectStore('snapshots'))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('浏览器存储不可用'))
    })
  } finally { db.close() }
}

export const saveLedgerCache = (bytes, filename) => cacheRequest('readwrite', store => store.put({ bytes, filename }, 'current'))
export const clearLedgerCache = () => cacheRequest('readwrite', store => store.delete('current'))
export const getLedgerCache = () => cacheRequest('readonly', store => store.get('current'))
export async function restoreLedgerCache() {
  const cached = await getLedgerCache()
  return cached ? readLedger(await sqlRuntime(), cached.bytes, cached.filename) : null
}
