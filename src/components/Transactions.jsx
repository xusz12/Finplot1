import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { Button, Input } from './ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { useApp } from '../store'
import { money, useFinance } from '../finance'
import { searchTransactions } from '../lib/exploration'
import { summarize } from '../lib/ledger'
import './transactions.css'

export function TransactionSearch({ value, onChange, label = '搜索当前筛选内的交易', inputRef, autoFocus = false }) {
  return <div className="transaction-search" role="search">
    <Search size={16} aria-hidden="true"/>
    <Input ref={inputRef} type="search" aria-label={label} placeholder="搜索备注、分类、标签、金额…" value={value}
      onChange={event => onChange(event.target.value)} autoFocus={autoFocus}/>
    {value && <Button variant="ghost" size="icon" aria-label="清空搜索" onClick={() => { onChange(''); inputRef?.current?.focus() }}><X size={14}/></Button>}
  </div>
}

export function TransactionTotals({ transactions, type = 'all' }) {
  const total = summarize(transactions)
  return <div className="transaction-totals" role="status" aria-live="polite">
    <strong>{total.count} 笔交易</strong>
    {type !== 'expense' && <span>收入 <b>+{money(total.income)}</b></span>}
    {type !== 'income' && <span>支出 <b>−{money(total.expense)}</b></span>}
  </div>
}

export function TransactionDetails({ transactions, onSelect, pageSize = 20 }) {
  const [pagination, setPagination] = useState({ transactions, page: 1 })
  const page = pagination.transactions === transactions ? pagination.page : 1
  const setPage = next => setPagination({ transactions, page: next })
  const pages = Math.max(1, Math.ceil(transactions.length / pageSize)), current = Math.min(page, pages)
  const visible = transactions.slice((current - 1) * pageSize, current * pageSize)
  if (!transactions.length) return <div className="transaction-empty" role="status"><Search size={22}/><strong>没有匹配的交易</strong><span>试试其他关键词，或清除筛选条件。</span></div>
  return <>
    <Table className="transaction-details"><TableHeader><TableRow>
      <TableHead scope="col">日期</TableHead><TableHead scope="col">备注 / 标签</TableHead>
      <TableHead scope="col">分类 / 性质</TableHead><TableHead scope="col">金额（元）</TableHead>
    </TableRow></TableHeader><TableBody>{visible.map(t => <TableRow key={t.id}>
      <TableCell className="transaction-date"><Button variant="ghost" onClick={() => onSelect(t)} aria-label={`查看 ${t.date} 当日交易`}>{t.date}</Button><small>{t.occurredAt?.slice(11, 16)}</small></TableCell>
      <TableCell className="transaction-description"><strong>{t.note?.trim() || t.name}</strong>
        {t.tags?.length > 0 && <div className="transaction-tag-list">{t.tags.map((tag, i) => <span key={`${tag.name}-${i}`}>#{tag.name}</span>)}</div>}
        {t.sourceRecordId && <small>来源编号：{t.sourceRecordId}</small>}
      </TableCell>
      <TableCell className="transaction-category"><strong>{t.category}</strong><small>{t.group} · {t.nature}{t.active === false ? ' · 历史停用' : ''}</small></TableCell>
      <TableCell className="transaction-amount"><strong className={t.direction === '收入' ? 'amount-positive' : ''}>{t.direction === '收入' ? '+' : '−'}{money(t.amountCents / 100)}</strong><small>{t.direction}</small></TableCell>
    </TableRow>)}</TableBody></Table>
    {pages > 1 && <div className="transaction-pagination"><span>{(current - 1) * pageSize + 1}–{Math.min(current * pageSize, transactions.length)} / {transactions.length} 笔</span>
      <Button variant="outline" size="icon" disabled={current === 1} aria-label="上一页交易" onClick={() => setPage(current - 1)}><ChevronLeft size={16}/></Button>
      <span aria-live="polite">{current} / {pages}</span>
      <Button variant="outline" size="icon" disabled={current === pages} aria-label="下一页交易" onClick={() => setPage(current + 1)}><ChevronRight size={16}/></Button>
    </div>}
  </>
}

export default function GlobalSearch() {
  const { searchOpen, setSearchOpen, openCalendarDate, ledger, serviceReady, ledgerLoading, serviceError } = useApp()
  const { source } = useFinance()
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const results = useMemo(() => searchTransactions(source.transactions, query), [source, query])
  useEffect(() => {
    const shortcut = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setSearchOpen(!useApp.getState().searchOpen)
      }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [setSearchOpen])
  return <Dialog open={searchOpen} onOpenChange={setSearchOpen}><DialogContent className="search-dialog" onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus() }}>
    <DialogTitle>搜索交易</DialogTitle>
    <DialogDescription>全部年份与性质 · {ledger ? '当前账本' : '示例数据'} · 金额单位：人民币元</DialogDescription>
    <TransactionSearch value={query} onChange={setQuery} label="搜索全部交易" inputRef={inputRef}/>
    <div className="search-results">
      {!serviceReady || ledgerLoading ? <div className="transaction-empty" role="status">{serviceError || '正在读取账本…'}</div> : query.trim() ? <>
        <TransactionTotals transactions={results}/>
        <TransactionDetails transactions={results} onSelect={t => openCalendarDate({ ...t, scopeNature: 'all' })}/>
      </> : <div className="transaction-empty"><Search size={24}/><strong>查找一笔交易</strong><span>支持日期、备注、分类、标签、金额和来源编号。</span></div>}
    </div>
  </DialogContent></Dialog>
}
