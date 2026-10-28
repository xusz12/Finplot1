import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import initSqlJs from 'sql.js'
import { readLedger } from '../src/lib/ledger.js'
import { atomicJson, httpError, readJson } from './common.mjs'

export async function createLedgerStore(dataDir) {
  const SQL = await initSqlJs()
  const directory = join(dataDir, 'ledger')
  const pointer = join(directory, 'current.json')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  let current = await readJson(pointer, { revision: 'empty', filename: null })
  let ledger = current.filename ? readLedger(SQL, await readFile(join(directory, `${current.revision}.sqlite3`)), current.filename) : null
  let busy = false
  const snapshot = () => ({ revision: current.revision, ledger })
  async function replace(bytes, filename, expectedRevision) {
    if (busy) throw httpError(409, '账本正在保存，请稍后重试。')
    if (expectedRevision !== current.revision) throw httpError(409, '账本已在其他页面更换，请刷新后重试。')
    busy = true
    try {
      const next = bytes ? readLedger(SQL, bytes, filename) : null
      const revision = randomUUID()
      if (bytes) {
        const destination = join(directory, `${revision}.sqlite3`)
        await writeFile(`${destination}.tmp`, bytes, { mode: 0o600 })
        await rename(`${destination}.tmp`, destination)
      }
      // Commit the pointer last. Old snapshots remain available for local recovery.
      const metadata = { revision, filename: next ? filename : null, previousRevision: current.revision, savedAt: new Date().toISOString() }
      await atomicJson(pointer, metadata)
      current = metadata
      ledger = next
      return snapshot()
    } finally { busy = false }
  }
  return { snapshot, replace }
}
