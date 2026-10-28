import React, { useState } from 'react'
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ReferenceLine, Sector, XAxis, YAxis } from 'recharts'
import { ArrowRight, ChevronLeft, X } from 'lucide-react'
import { AnimatedText, Button, Card, SegmentedControl } from './ui'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart'
import { financialChartConfig, withChartColors } from '../design-system/chart'
import { useReducedMotionPreference } from '../design-system/motion'
import { money, percent } from '../finance'
import { groupTransactions } from '../lib/exploration'
import { useApp } from '../store'
import { TransactionDetails, TransactionSearch, TransactionTotals } from './Transactions'
import './overview-explorer.css'

function MonthTick({ x, y, payload, data, selectedMonth, onSelect }) {
  const row = data[payload.index]
  if (!row) return null
  const selected = row.month === selectedMonth
  return <g transform={`translate(${x},${y})`} role={row.available ? 'button' : undefined} tabIndex={row.available ? 0 : undefined}
    aria-label={row.available ? `${selected ? '取消' : '筛选'} ${row.month} 月` : `${row.month} 月，账本未覆盖`} aria-pressed={row.available ? selected : undefined}
    onClick={event => { event.stopPropagation(); if (row.available) onSelect(row.month) }}
    onKeyDown={event => { if (row.available && ['Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopPropagation(); onSelect(row.month) } }}
    className={`trend-month ${selected ? 'selected' : ''} ${!row.available ? 'unavailable' : ''}`}>
    <rect x={-14} y={0} width={28} height={25} rx={5}/><text x={0} y={15} textAnchor="middle">{row.month}<tspan className="trend-month-unit">月</tspan></text>
  </g>
}

export function OverviewTrend({ data, type, selectedMonth, onMonth, onType }) {
  const reducedMotion = useReducedMotionPreference()
  return <Card className="chart-card trend-card"><div className="card-heading"><div className="card-title-row"><h3>收支趋势</h3><span className="tiny-tag">全年</span></div>
    <div className="trend-type-legend" aria-label="趋势收支筛选">{['income', 'expense'].map(key => <Button key={key} variant="ghost" size="sm" aria-pressed={type === key} aria-label={`筛选${key === 'income' ? '收入' : '支出'}趋势`} onClick={() => onType(key)} className={type !== 'all' && type !== key ? 'muted' : ''}><i style={{ background: `var(--${key})` }}/>{key === 'income' ? '收入' : '支出'}</Button>)}</div>
  </div><div className="trend-chart"><ChartContainer config={financialChartConfig} className="finplot-chart"><LineChart data={data} margin={{ top: 12, right: 10, left: -20, bottom: 8 }}
    onClick={state => { const row = data.find(item => item.name === state?.activeLabel); if (row?.available) onMonth(row.month) }}>
    <CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="3 5"/>
    <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} height={32} tick={<MonthTick data={data} selectedMonth={selectedMonth} onSelect={onMonth}/>}/>
    <YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--soft-text)', fontSize: 10 }} tickFormatter={v => Math.abs(v) >= 10000 ? `${+(v / 10000).toFixed(1)}万` : v.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} domain={[0, 'auto']}/>
    <ChartTooltip isAnimationActive={!reducedMotion} content={<ChartTooltipContent className="financial-chart-tooltip" valueFormatter={money}/>} cursor={{ stroke: 'var(--border)', strokeDasharray: '3 4' }}/>
    {selectedMonth && <ReferenceLine x={`${selectedMonth}月`} stroke="var(--accent)" strokeDasharray="3 4"/>}
    {type !== 'expense' && <Line isAnimationActive={!reducedMotion} type="monotone" dataKey="income" name="收入" stroke="var(--income)" strokeWidth={2.6} dot={false} activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 3 }}/>}
    {type !== 'income' && <Line isAnimationActive={!reducedMotion} type="monotone" dataKey="expense" name="支出" stroke="var(--expense)" strokeWidth={2.6} dot={false} activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 3 }}/>}
  </LineChart></ChartContainer></div></Card>
}

export function OverviewBreakdown({ transactions }) {
  const { overviewFilters: filters, setOverviewType, selectOverviewGroup, selectOverviewCategory, clearOverviewGroup } = useApp()
  const [displayType, setDisplayType] = useState('expense')
  const reducedMotion = useReducedMotionPreference()
  const type = filters.type === 'all' ? displayType : filters.type
  const items = withChartColors(groupTransactions(transactions, type, filters.group ? 'category' : 'group'))
  const selected = filters.category
  const select = item => filters.group ? selectOverviewCategory({ id: item.id, name: item.name }) : selectOverviewGroup({ id: item.id, name: item.name }, type)
  const total = items.reduce((sum, item) => sum + item.cents, 0) / 100
  const center = selected ? items.find(item => item.id === selected.id)?.value ?? 0 : total
  const renderSector = props => <g role="button" tabIndex={0} className="category-sector"
    aria-label={`${selected?.id === props.payload?.id ? '取消' : '筛选'}${props.name}，${money(props.value)}`}
    aria-pressed={selected?.id === props.payload?.id}
    onKeyDown={event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); event.stopPropagation(); select(props.payload) } }}>
    <Sector {...props} tabIndex={-1}/>
  </g>
  return <Card className="chart-card breakdown-card"><div className="card-heading"><h3>收支构成</h3><SegmentedControl compact label="收支构成" value={type}
    onValueChange={value => { setDisplayType(value); setOverviewType(value) }} options={[{ value: 'expense', label: '支出' }, { value: 'income', label: '收入' }]}/></div>
    {filters.group && <div className="breakdown-breadcrumb"><Button variant="ghost" size="sm" onClick={clearOverviewGroup} aria-label={`取消${filters.group.name}分类筛选`}><ChevronLeft size={13}/>{filters.group.name}</Button><span>子类型</span></div>}
    {items.length ? <div className="donut-layout"><div className="donut-wrap"><ChartContainer config={financialChartConfig} className="finplot-chart"><PieChart><Pie
      isAnimationActive={!reducedMotion} data={items} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="92%" paddingAngle={3} stroke="none" cornerRadius={3}
      onClick={item => select(item)} rootTabIndex={-1} activeIndex={items.findIndex(item => item.id === selected?.id)}
      activeShape={renderSector} inactiveShape={renderSector}>
      {items.map(item => <Cell key={item.id} fill={item.color} opacity={selected && selected.id !== item.id ? .35 : 1}
        stroke={selected?.id === item.id ? 'var(--interactive-text)' : 'none'} strokeWidth={2}/>)}</Pie>
      <ChartTooltip isAnimationActive={!reducedMotion} content={<ChartTooltipContent className="financial-chart-tooltip" valueFormatter={money} hideLabel/>}/>
    </PieChart></ChartContainer><div className="donut-center"><span title={selected?.name ?? filters.group?.name}>{selected?.name ?? filters.group?.name ?? `总${type === 'expense' ? '支出' : '收入'}`}</span><strong><AnimatedText>{money(center)}</AnimatedText></strong></div></div>
      <div className="donut-legend filterable-legend">{items.map(item => <Button key={item.id} variant="ghost" className="category-filter" aria-pressed={selected?.id === item.id} onClick={() => select(item)}
        aria-label={`${selected?.id === item.id ? '取消' : '筛选'}${item.name}，${money(item.value)}，${percent(item.share)}%`}>
        <span><i style={{ background: item.color }}/><span>{item.name}</span></span><strong>{percent(item.share)}%</strong>
      </Button>)}</div>
    </div> : <div className="transaction-empty">当前条件下暂无{type === 'income' ? '收入' : '支出'}记录</div>}
    <div className="breakdown-footer"><span>{filters.group ? '子类型' : '分类分组'} {items.length} 类</span><span>{items.reduce((sum, item) => sum + item.count, 0)} 笔 · {money(total)}</span></div>
  </Card>
}

export function OverviewFilterBar() {
  const { overviewFilters: filters, year, mode, month, setMode, setOverviewQuery, toggleOverviewType,
    clearOverviewGroup, clearOverviewCategory, clearOverviewFilters } = useApp()
  const chips = [
    ...(mode === 'month' ? [{ key: 'month', label: `${year} 年 ${month} 月`, clear: () => setMode('year') }] : []),
    ...(filters.type !== 'all' ? [{ key: 'type', label: filters.type === 'income' ? '收入' : '支出', clear: () => toggleOverviewType(filters.type) }] : []),
    ...(filters.group ? [{ key: 'group', label: filters.group.name, clear: clearOverviewGroup }] : []),
    ...(filters.category ? [{ key: 'category', label: filters.category.name, clear: clearOverviewCategory }] : []),
  ]
  return <div className="overview-filter-bar"><TransactionSearch value={filters.query} onChange={setOverviewQuery}/>
    <div className="overview-filter-chips" aria-label="已选筛选条件">{chips.map(chip => <Button key={chip.key} variant="subtle" size="sm" onClick={chip.clear} aria-label={`移除${chip.label}筛选`}>{chip.label}<X size={12}/></Button>)}
      {(chips.length > 0 || filters.query) && <Button variant="ghost" size="sm" onClick={clearOverviewFilters}>清除筛选</Button>}
    </div>
  </div>
}

export function OverviewRecent({ transactions, expanded, onExpand, onCollapse }) {
  const { year, mode, month, overviewFilters, openCalendarDate } = useApp()
  return <Card className="chart-card recent-card"><div className="card-heading"><div><h3>最近交易</h3><p><AnimatedText>{`${year} 年${mode === 'month' ? ` ${month} 月` : '全年'}`}</AnimatedText></p></div>
    {expanded ? onCollapse && <Button variant="ghost" className="text-link" onClick={onCollapse}>收起明细</Button> : <Button variant="ghost" className="text-link" onClick={onExpand}>查看全部 <ArrowRight size={14}/></Button>}
  </div>{expanded ? <><TransactionTotals transactions={transactions} type={overviewFilters.type}/><TransactionDetails transactions={transactions} onSelect={openCalendarDate}/></> : <div className="transaction-list">
    {transactions.slice(0, 4).map(t => <Button variant="ghost" className="recent-transaction" key={t.id} onClick={() => openCalendarDate(t)}>
      <span><strong>{t.name}</strong><small>{t.month}月{t.day}日 · {t.category}</small></span><b className={t.direction === '收入' ? 'amount-positive' : ''}>{t.direction === '收入' ? '+' : '−'}{money(t.amountCents / 100)}</b>
    </Button>)}{!transactions.length && <div className="transaction-empty">本期暂无交易记录</div>}
  </div>}</Card>
}
