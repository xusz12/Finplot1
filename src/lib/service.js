import { useApp } from '../store'
import { restoreLedgerCache, getLedgerCache } from './ledger-file'
import { version as appVersion } from '../../package.json'

let session
export async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', signal: AbortSignal.timeout(45_000), ...options,
    headers: { ...(session ? { 'X-Finplot-Session': session.token } : {}), ...options.headers } })
  if (response.status === 204) return null
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('请启动 Finplot 服务后重试。')
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || '请求失败，请重试。')
  return value
}
function receive(snapshot, initial = false) {
  if (!snapshot) return
  const state = useApp.getState()
  if (snapshot.ledger) {
    if (initial || !state.ledger || (snapshot.ledger.years.length && !snapshot.ledger.years.includes(state.year))) state.setLedger(snapshot.ledger)
    else useApp.setState({ ledger: snapshot.ledger })
  } else if (state.ledger) state.clearLedger()
  useApp.setState({ ledgerRevision: snapshot.revision })
}
export async function connectService() {
  const response = await fetch('/api/status', { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  // Explicit static preview only. Network/server errors never silently become sample data.
  if ((response.status === 404 || response.ok) && !response.headers.get('content-type')?.includes('application/json')) {
    session = null
    useApp.setState({ serviceMode: 'browser' })
    const ledger = await restoreLedgerCache()
    if (ledger) useApp.getState().setLedger(ledger)
    useApp.setState({ serviceReady: true })
    return
  }
  if (!response.ok) throw new Error('无法连接账本服务，请确认服务正在运行。')
  session = await response.json()
  useApp.setState({ serviceMode: 'server', service: session })
  receive(await api('/api/ledger'), true)
  if (!useApp.getState().ledger) {
    try { useApp.setState({ legacyLedger: await getLedgerCache() }) } catch { /* Optional migration. */ }
  }
  useApp.setState({ serviceReady: true })
}
export async function syncLedger() {
  const state = useApp.getState()
  if (state.serviceMode !== 'server' || state.ledgerLoading) return
  session = await api('/api/status')
  if (session.version !== appVersion) { window.location.reload(); return }
  useApp.setState({ service: session })
  const snapshot = await api(`/api/ledger?revision=${encodeURIComponent(state.ledgerRevision)}`)
  // Do not let an older in-flight poll overwrite a just-saved snapshot.
  if (useApp.getState().ledgerLoading || useApp.getState().ledgerRevision !== state.ledgerRevision) return
  receive(snapshot)
}
export async function uploadLedger(bytes, filename) {
  receive(await api('/api/ledger', { method: 'PUT', body: bytes,
    headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(filename), 'If-Match': useApp.getState().ledgerRevision } }), true)
}
export async function removeSharedLedger() {
  receive(await api('/api/ledger', { method: 'DELETE', headers: { 'If-Match': useApp.getState().ledgerRevision } }))
}
