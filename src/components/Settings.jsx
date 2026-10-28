import React, { useEffect, useRef, useState } from 'react'
import { Database, FileUp, LockKeyhole, RefreshCw, Server } from 'lucide-react'
import { version as appVersion } from '../../package.json'
import { Button, Card, Badge } from './ui'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from './ui/dialog'
import { useApp } from '../store'
import { importLedgerFile, saveLedgerCache, clearLedgerCache } from '../lib/ledger-file'
import { api, uploadLedger, removeSharedLedger } from '../lib/service'

function UpdateSettings() {
  const { serviceMode } = useApp()
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const connected = serviceMode === 'server'
  const installing = state?.phase === 'installing'
  const checking = busy || state?.phase === 'checking'
  useEffect(() => {
    if (!connected) return
    let cancelled = false
    const read = () => api('/api/updates').then(next => {
      if (cancelled) return
      setState(next); setError('')
      if (next.currentVersion !== appVersion && next.phase === 'idle') window.location.reload()
    }).catch(() => { if (!cancelled && !installing) setError('无法读取更新状态，请重试。') })
    void read()
    const timer = setInterval(read, installing ? 2000 : 15_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [connected, installing])
  const perform = async action => {
    setBusy(true); setError('')
    try {
      const next = await api(`/api/updates/${action}`, { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: state?.latest?.version }) })
      setState(next)
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  const message = !connected ? '启动本机服务后可检查和安装更新。' : installing ? '正在安装更新，完成后自动重启并刷新。'
    : checking ? '正在检查更新…' : (error || state?.error) ? '更新未完成，请重试。' : state?.available ? `发现新版本 v${state.latest.version}`
      : state?.checkedAt ? '当前已是最新版本。' : '启动后自动检查更新，每 6 小时检查一次。'
  return <Card className="settings-card"><div className="settings-title"><span><RefreshCw size={19}/></span><h3>应用更新</h3></div>
    <div className="settings-body"><div className="settings-row"><div><strong>Finplot <Badge>v{appVersion}</Badge></strong><p role="status">{message}</p></div>
      <div className="settings-actions"><Button variant="outline" disabled={!connected || checking || installing} onClick={() => perform('check')}><RefreshCw size={15}/>{checking ? '检查中…' : '检查更新'}</Button>
        {state?.available && <Dialog open={confirm} onOpenChange={setConfirm}><DialogTrigger asChild><Button disabled={checking || installing}>安装更新</Button></DialogTrigger><DialogContent><DialogTitle>更新至 v{state.latest.version}</DialogTitle><DialogDescription>安装完成后服务会短暂重启，账本和本地备份会保留。更新失败时恢复原版本。</DialogDescription><DialogFooter><DialogClose asChild><Button variant="outline">取消</Button></DialogClose><Button onClick={() => { setConfirm(false); void perform('install') }}>更新并重启</Button></DialogFooter></DialogContent></Dialog>}
      </div></div>
      {(error || state?.error) && <p role="alert" className="ledger-message ledger-error">{error || state.error}</p>}
      {state?.checkedAt && <p className="update-time">上次成功检查：{new Date(state.checkedAt).toLocaleString('zh-CN')}</p>}
    </div></Card>
}

export default function Settings() {
  const fileRef = useRef(null)
  const { ledger, ledgerLoading, ledgerError, ledgerNotice, setLedger, clearLedger, serviceMode, service, legacyLedger } = useApp()
  const [removeOpen, setRemoveOpen] = useState(false)
  const shared = serviceMode === 'server'
  const save = async (bytes, filename, parsed) => {
    if (shared) await uploadLedger(bytes, filename)
    else {
      // A failed write must not leave an older cached ledger presented as the new one.
      await saveLedgerCache(bytes, filename)
      setLedger(parsed)
    }
    useApp.setState({ ledgerNotice: shared ? '账本已保存，其他设备会自动同步。' : '已保存到当前浏览器。', legacyLedger: null })
  }
  const chooseFile = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || useApp.getState().ledgerLoading) return
    useApp.setState({ ledgerLoading: true, ledgerError: '', ledgerNotice: '' })
    try {
      const { ledger: next, bytes } = await importLedgerFile(file)
      await save(bytes, file.name, next)
    } catch (error) { useApp.setState({ ledgerError: `${error.message} 当前账本未更换。` }) }
    finally { useApp.setState({ ledgerLoading: false }) }
  }
  const migrate = async () => {
    useApp.setState({ ledgerLoading: true, ledgerError: '', ledgerNotice: '' })
    try { await uploadLedger(legacyLedger.bytes, legacyLedger.filename); useApp.setState({ legacyLedger: null, ledgerNotice: '账本已迁移到本机服务，浏览器原副本保留。' }) }
    catch (error) { useApp.setState({ ledgerError: error.message }) }
    finally { useApp.setState({ ledgerLoading: false }) }
  }
  const remove = async () => {
    setRemoveOpen(false)
    useApp.setState({ ledgerLoading: true, ledgerError: '', ledgerNotice: '' })
    try {
      if (shared) await removeSharedLedger()
      else { await clearLedgerCache(); clearLedger() }
      useApp.setState({ ledgerNotice: shared ? '已移除当前账本，服务端历史备份保留。' : '已移除浏览器副本。' })
    } catch (error) { useApp.setState({ ledgerError: error.message }) }
    finally { useApp.setState({ ledgerLoading: false }) }
  }
  return <><div className="page-intro"><h1>设置</h1></div><div className="settings-layout">
    <Card className="settings-card"><div className="settings-title"><span><Database size={19}/></span><h3>账本</h3></div><div className="settings-body">
      <div className="settings-row"><div><strong>{ledger ? ledger.filename : '尚未接入账本'}</strong><p>{ledger ? `${ledger.transactions.length.toLocaleString('zh-CN')} 笔交易 · 收入 ${ledger.incomeCount} 笔 · 支出 ${ledger.expenseCount} 笔` : 'StaffX SQLite 快照 · 最大 100 MB'}{ledger?.cutoff && <><br/>最新交易：{ledger.cutoff}</>}</p></div>
        <input ref={fileRef} aria-label="选择 SQLite 账本" type="file" accept=".sqlite,.sqlite3,.db" hidden onChange={chooseFile}/><Button variant="outline" disabled={ledgerLoading} onClick={() => fileRef.current?.click()}><FileUp size={15}/>{ledgerLoading ? '读取中…' : ledger ? '更换账本' : '选择文件'}</Button>
      </div>
      {legacyLedger && !ledger && shared && <div className="migration-row"><p>发现当前浏览器的账本「{legacyLedger.filename}」，可保存到本机服务供其他设备使用。</p><Button variant="outline" disabled={ledgerLoading} onClick={migrate}>迁移浏览器账本</Button></div>}
      {ledgerError && <p role="alert" className="ledger-message ledger-error">{ledgerError}</p>}{ledgerNotice && <p role="status" className="ledger-message">{ledgerNotice}</p>}
      <div className="settings-info"><LockKeyhole size={15}/><span>{shared ? '所有设备共用此账本，副本保存在运行服务的电脑。原文件保持不变；新快照需手动更换。' : '浏览器预览：账本仅保存在当前浏览器。通过本机服务访问可在设备间共用账本。'}</span></div>
      {ledger && <div className="ledger-remove"><Dialog open={removeOpen} onOpenChange={setRemoveOpen}><DialogTrigger asChild><Button variant="ghost" disabled={ledgerLoading}>移除账本</Button></DialogTrigger><DialogContent><DialogTitle>移除当前账本</DialogTitle><DialogDescription>{shared ? '所有设备将返回示例数据。原文件和服务端历史备份保留。' : '当前浏览器将返回示例数据，原文件保持不变。'}</DialogDescription><DialogFooter><DialogClose asChild><Button variant="outline">取消</Button></DialogClose><Button onClick={remove}>移除账本</Button></DialogFooter></DialogContent></Dialog></div>}
    </div></Card>
    <UpdateSettings/>
    {shared && <Card className="settings-card"><div className="settings-title"><span><Server size={19}/></span><h3>服务与访问</h3></div><div className="settings-body"><div className="service-addresses">{service.urls.map((url, i) => <div key={url}><span>{i ? 'Tailscale' : '本机'}</span><a href={url}>{url}</a></div>)}</div><p className="ledger-message">{service.urls.length > 1 ? '已连接 Tailscale，允许访问此设备的成员可读写账本。' : 'Tailscale 未连接。连接后重启服务即可启用远程访问。'}</p></div></Card>}
  </div></>
}
