import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import * as Dialog from '@radix-ui/react-dialog'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, ArrowDownLeft, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Coffee, Database, Download, Ellipsis, FileUp, Grip, Home, LayoutDashboard, LineChart as LineChartIcon, LockKeyhole, RefreshCw, Settings2, ShoppingBag, SlidersHorizontal, Sparkles, TrainFront, TrendingUp, Wallet, X } from 'lucide-react'
import { Button, Card, Badge, MetricCard, NativeSelect, SectionHeading, SegmentedControl } from './components/ui'
import { withChartColors } from './design-system/chart'
import { useApp } from './store'
import { categories, investmentData, monthTransactions, money, totals, yearData } from './data'

const nav = [
  { id: 'overview', label: '财务总览', icon: LayoutDashboard },
  { id: 'analysis', label: '收支分析', icon: SlidersHorizontal },
  { id: 'calendar', label: '收支日历', icon: CalendarDays },
  { id: 'investments', label: '投资记录', icon: TrendingUp },
]
const pageLabels = { overview: '财务总览', analysis: '收支分析', calendar: '收支日历', investments: '投资记录', settings: '设置' }
const iconMap = { shopping: ShoppingBag, coffee: Coffee, income: ArrowDownLeft, travel: TrainFront, home: Home, spark: Sparkles }

function useNarrowScreen() {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 1020px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1020px)')
    const onChange = (event) => setNarrow(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return narrow
}

function Logo() { return <div className="logo-lockup"><div className="logo-symbol"><span/><span/><span/><span/></div><div><strong>finplot<span>.</span></strong><small>PERSONAL FINANCE</small></div></div> }
function Sidebar() {
  const { page, setPage } = useApp()
  return <aside className="sidebar">
    <Logo />
    <div className="sidebar-label">WORKSPACE <span>工作空间</span></div>
    <nav className="side-nav" aria-label="主导航">
      {nav.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => setPage(id)} aria-label={label} className={`nav-item ${page === id ? 'active' : ''}`}><Icon size={17} strokeWidth={1.7}/><span>{label}</span>{page === id && <i/>}</button>)}
    </nav>
    <div className="sidebar-label lower-label">PREFERENCES <span>偏好设置</span></div>
    <button type="button" onClick={() => setPage('settings')} aria-label="设置" className={`nav-item ${page === 'settings' ? 'active' : ''}`}><Settings2 size={17} strokeWidth={1.7}/><span>设置</span>{page === 'settings' && <i/>}</button>
    <div className="sidebar-spacer" />
    <div className="side-note"><div className="side-note-top"><Sparkles size={15}/><span>A LITTLE REMINDER</span></div><p>每一个小小的决定，<br/>都在塑造你的未来。</p><div className="side-note-line"><span>为生活，留一份从容</span><ArrowUpRight size={14}/></div></div>
    <div className="profile"><div className="avatar">林</div><div><strong>林小满</strong><span>我的个人账本</span></div><Ellipsis size={18}/></div>
    <div className="side-footer">PERSONAL FINANCE<span>v1.0</span></div>
  </aside>
}
function DataDialog() {
  return <Dialog.Root><Dialog.Trigger asChild><button className="data-status"><span/>示例数据 <CircleHelp size={13}/></button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content"><div className="dialog-icon"><Database size={20}/></div><Dialog.Title>关于这份原型</Dialog.Title><Dialog.Description>当前展示的是虚构的个人财务示例数据，用于体验分析与设计。选择 SQLite 文件仅演示接入流程，文件不会被读取或上传。</Dialog.Description><div className="dialog-footer"><Dialog.Close asChild><Button>明白了</Button></Dialog.Close></div><Dialog.Close className="dialog-close" aria-label="关闭"><X size={18}/></Dialog.Close></Dialog.Content></Dialog.Portal></Dialog.Root>
}
function Header() {
  const { page } = useApp()
  return <header className="app-header"><div className="breadcrumbs"><span>我的账本</span><ChevronRight size={13}/><strong>{pageLabels[page]}</strong></div><div className="header-right"><DataDialog/><span className="header-divider"/><span className="header-date">让数字，回到生活</span><div className="header-avatar">林</div></div></header>
}
function PeriodControls({ allowMode = true }) {
  const { year, setYear, month, setMonth, mode, setMode } = useApp()
  return <div className="period-controls">
    {allowMode && <SegmentedControl label="时间范围" value={mode} onValueChange={setMode} options={[{ value: 'year', label: '年度' }, { value: 'month', label: '月度' }]}/>}
    <NativeSelect label="选择年份" value={year} onChange={e => setYear(e.target.value)}><option value={2025}>2025 年</option><option value={2024}>2024 年</option></NativeSelect>
    {(!allowMode || mode === 'month') && <NativeSelect label="选择月份" value={month} onChange={e => setMonth(e.target.value)}>{Array.from({length:12}, (_,i) => <option value={i+1} key={i}>{i+1} 月</option>)}</NativeSelect>}
  </div>
}
function exportData(year, mode, month) {
  const rows = yearData(year).filter(d => mode === 'year' || d.month === month)
  const csv = '\ufeff月份,收入,支出,结余\n' + rows.map(r => `${year}-${String(r.month).padStart(2,'0')},${r.income},${r.expense},${r.balance}`).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = `finplot-${year}${mode === 'month' ? '-' + String(month).padStart(2,'0') : ''}.csv`; a.click(); URL.revokeObjectURL(url)
}
function PageIntro({ eyebrow, title, subtitle, controls = true, exportButton = false }) {
  const { year, month, mode } = useApp()
  return <div className="page-intro"><div><div className="eyebrow"><span>{eyebrow}</span><i/> <span>YOUR MONEY, IN PERSPECTIVE</span></div><h1>{title}<span className="heading-period">.</span></h1><p>{subtitle}</p></div><div className="intro-actions">{controls && <PeriodControls/>}{exportButton && <Button variant="outline" onClick={() => exportData(year,mode,month)}><Download size={15}/> 导出报表</Button>}</div></div>
}
function SortableMetric({ id, data, previous, period }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const values = {
    income: { label: '总收入', value: money(data.income, 2), icon: ArrowDownLeft, note: '为生活创造更多可能', tone: 'income' },
    expense: { label: '总支出', value: money(data.expense, 2), icon: ArrowUpRight, note: '认真生活的每一笔', tone: 'expense' },
    balance: { label: '收支结余', value: money(data.balance, 2), icon: Wallet, note: data.balance > 0 ? '盈余 · 收支健康' : data.balance < 0 ? '超支 · 支出超过收入' : '平衡 · 收支恰好相等', tone: 'balance' },
    rate: { label: '结余率', value: `${data.rate.toFixed(1)}%`, icon: Activity, note: '收入中被留下的部分', tone: 'rate' },
  }
  const item = values[id]; const Icon = item.icon
  let change = id === 'rate' ? data.rate - previous.rate : previous[id] ? (data[id] - previous[id]) / Math.abs(previous[id]) * 100 : 0
  const favorable = id === 'expense' ? change <= 0 : change >= 0
  const changeText = id === 'rate' ? `${change >= 0 ? '+' : ''}${change.toFixed(1)} 个百分点` : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 3 : undefined }} className={`metric-wrap ${isDragging ? 'dragging' : ''}`}><MetricCard label={item.label} value={item.value} icon={Icon} tone={item.tone} change={changeText} comparison={period} favorable={favorable} status={id === 'balance' ? item.note : undefined} action={<button className="drag-handle" {...attributes} {...listeners} aria-label={`拖动调整${item.label}卡片顺序`}><Grip size={15}/></button>}/></div>
}
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return <div className="chart-tooltip"><strong>{label}</strong>{payload.map(p => <div key={p.dataKey}><span style={{background:p.color}}/>{p.name}<b>{money(p.value)}</b></div>)}</div>
}
function TrendCard({ data }) {
  return <Card className="chart-card trend-card"><div className="card-heading"><div><div className="card-title-row"><h3>收支趋势</h3><span className="tiny-tag">全年</span></div><p>收入与支出，随时间的变化</p></div><div className="chart-legend"><span><i className="income-dot"/>收入</span><span><i className="expense-dot"/>支出</span></div></div>
    <div className="trend-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{top:16,right:8,left:-20,bottom:0}}><CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="3 5"/><XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} tick={{fill:'var(--muted)',fontSize:11}} dy={10}/><YAxis tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:11}} tickFormatter={v => v === 0 ? '0' : `${v/10000}万`} domain={[0, 40000]} ticks={[0,10000,20000,30000,40000]}/><Tooltip content={<ChartTooltip/>} cursor={{stroke:'var(--border)',strokeDasharray:'3 4'}}/><Line type="monotone" dataKey="income" name="收入" stroke="var(--income)" strokeWidth={2.6} dot={false} activeDot={{r:5,stroke:'var(--card)',strokeWidth:3}}/><Line type="monotone" dataKey="expense" name="支出" stroke="var(--expense)" strokeWidth={2.3} dot={false} activeDot={{r:5,stroke:'var(--card)',strokeWidth:3}}/></LineChart></ResponsiveContainer></div>
    <div className="chart-footnote"><span><Sparkles size={14}/> 每一笔收支，都让未来的轮廓更清晰。</span><span>金额单位：人民币</span></div>
  </Card>
}
function BreakdownCard({ data }) {
  const [type, setType] = useState('expense')
  const items = withChartColors(categories(type, data[type]))
  return <Card className="chart-card breakdown-card"><div className="card-heading"><div><h3>收支构成</h3><p>看看钱从哪里来，去了哪里</p></div><SegmentedControl compact label="收支构成" value={type} onValueChange={setType} options={[{ value: 'expense', label: '支出' }, { value: 'income', label: '收入' }]}/></div>
    <div className="donut-layout"><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={items} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="94%" paddingAngle={3} stroke="none" cornerRadius={3}>{items.map(item => <Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip formatter={v => money(v)} contentStyle={{border:'1px solid var(--border)',borderRadius:10,fontSize:12}}/></PieChart></ResponsiveContainer><div className="donut-center"><span>总{type === 'expense' ? '支出' : '收入'}</span><strong>{money(data[type])}</strong></div></div><div className="donut-legend">{items.map(item => <div key={item.name}><span><i style={{background:item.color}}/>{item.name}</span><strong>{Math.round(item.share*100)}%</strong></div>)}</div></div>
    <div className="breakdown-footer"><span>占比最高</span><strong>{items[0].name}</strong><span>{money(items[0].value)}</span></div>
  </Card>
}
function BalanceCard({ data }) {
  const highest = data.reduce((a,b) => b.balance > a.balance ? b : a, data[0])
  return <Card className="chart-card balance-card"><div className="card-heading"><div><h3>逐月结余</h3><p>每个月留下的，都是向前的底气</p></div><div className="balance-highlight"><span>最佳月份</span><strong>{highest.month} 月 <em>{money(highest.balance)}</em></strong></div></div><div className="balance-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{top:8,right:4,left:-24,bottom:0}}><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5"/><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:10}} dy={8}/><YAxis tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:10}} tickFormatter={v => v === 0 ? '0' : `${v/10000}万`}/><Tooltip content={<ChartTooltip/>} cursor={{fill:'var(--hover)'}}/><Bar dataKey="balance" name="结余" fill="var(--income)" radius={[5,5,0,0]} maxBarSize={22}>{data.map((d,i) => <Cell key={i} fill={d.month === highest.month ? 'var(--income)' : 'var(--bar-soft)'}/>)}</Bar></BarChart></ResponsiveContainer></div></Card>
}
function TransactionIcon({ type }) { const Icon = iconMap[type] || ShoppingBag; return <span className={`transaction-icon ${type}`}><Icon size={16} strokeWidth={1.7}/></span> }
function RecentCard({ month, year, onView }) {
  const transactions = monthTransactions(year, month)
  return <Card className="chart-card recent-card"><div className="card-heading"><div><h3>最近的生活</h3><p>{year} 年 {month} 月 · 部分示例交易</p></div><button className="text-link" onClick={onView}>查看日历 <ArrowRight size={14}/></button></div><div className="transaction-list">{transactions.slice(0,4).map(t => <div className="transaction-row" key={t.day}><TransactionIcon type={t.icon}/><div><strong>{t.name}</strong><span>{month}月{t.day}日 · {t.category}</span></div><b className={t.amount > 0 ? 'amount-positive' : ''}>{t.amount > 0 ? '+' : '−'}{money(Math.abs(t.amount))}</b></div>)}</div></Card>
}
function Overview() {
  const { year, mode, month, metricOrder, setMetricOrder, setPage } = useApp()
  const data = totals(year,mode,month), previous = totals(year-1,mode,month), series = yearData(year)
  const narrow = useNarrowScreen()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const onDragEnd = ({ active, over }) => { if (over && active.id !== over.id) setMetricOrder(arrayMove(metricOrder, metricOrder.indexOf(active.id), metricOrder.indexOf(over.id))) }
  return <><PageIntro eyebrow="01 / OVERVIEW" title="财务总览" subtitle="你好，小满。让我们一起看看，你的生活正在如何生长。" exportButton/>
    <SectionHeading title="你的财务概览" meta={mode === 'year' ? `${year} 年度` : `${year} 年 ${month} 月`} action={<span className="section-hint"><Grip size={14}/> 拖动卡片调整顺序</span>}/>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={metricOrder} strategy={rectSortingStrategy}><div className="metrics-grid">{metricOrder.map(id => <SortableMetric key={id} id={id} data={data} previous={previous} period="去年同期"/>)}</div></SortableContext></DndContext>
    <div className="dashboard-heading"><SectionHeading title="看见变化" meta="THE BIG PICTURE" action={<span className="section-hint resize-hint">拖动中间分隔线调整宽度</span>}/></div>
    {narrow ? <div className="mobile-charts"><TrendCard data={series}/><BreakdownCard data={data}/></div> : <div className="desktop-charts"><PanelGroup direction="horizontal" autoSaveId="finplot-panels"><Panel defaultSize={65} minSize={48}><TrendCard data={series}/></Panel><PanelResizeHandle className="resize-handle"><span/></PanelResizeHandle><Panel defaultSize={35} minSize={30}><BreakdownCard data={data}/></Panel></PanelGroup></div>}
    <div className="lower-grid"><BalanceCard data={series}/><RecentCard year={year} month={month} onView={() => setPage('calendar')}/></div>
    <div className="page-end"><span>FINPLOT / A CLEARER PICTURE OF YOUR MONEY</span><span>用心生活，也用心记录。 ✳</span></div>
  </>
}
function CategoryBlock({ type, amount }) {
  const items = withChartColors(categories(type,amount))
  const isIncome = type === 'income'
  return <Card className="category-card"><div className="category-head"><div><div className={`category-icon ${type}`}>{isIncome ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}</div><div><span>{isIncome ? 'MONEY IN' : 'MONEY OUT'}</span><h3>{isIncome ? '收入构成' : '支出构成'}</h3></div></div><strong>{money(amount,2)}</strong></div><div className="category-visual"><div className="analysis-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={items} dataKey="value" innerRadius="70%" outerRadius="94%" paddingAngle={3} stroke="none" cornerRadius={3}>{items.map(i => <Cell key={i.name} fill={i.color}/>)}</Pie><Tooltip formatter={v => money(v)}/></PieChart></ResponsiveContainer><div className="donut-center"><span>{isIncome ? '收入分类' : '支出分类'}</span><strong>{items.length} 类</strong></div></div><div className="category-insight"><span>最大{isIncome ? '收入来源' : '支出项目'}</span><strong>{items[0].name}</strong><p>占总{isIncome ? '收入' : '支出'}的 {Math.round(items[0].share*100)}%</p></div></div><div className="category-table-head"><span>分类</span><span>金额 / 占比</span></div>{items.map(item => <div className="category-row" key={item.name}><div><i style={{background:item.color}}/><span>{item.name}</span></div><div><strong>{money(item.value)}</strong><span>{Math.round(item.share*100)}%</span></div><div className="category-progress"><span style={{width:`${item.share*100}%`,background:item.color}}/></div></div>)}</Card>
}
function Analysis() {
  const { year,mode,month } = useApp(); const data = totals(year,mode,month)
  return <><PageIntro eyebrow="02 / ANALYSIS" title="收支分析" subtitle="把数字拆开来看，生活的偏好也渐渐清晰。" exportButton/><SectionHeading title="每一笔的去向" meta={mode === 'year' ? `${year} 年度` : `${year} 年 ${month} 月`}/><div className="analysis-grid"><CategoryBlock type="income" amount={data.income}/><CategoryBlock type="expense" amount={data.expense}/></div><div className="insight-banner"><span className="insight-spark"><Sparkles size={19}/></span><div><strong>一点值得留意的事</strong><p>本期你留下了收入的 {data.rate.toFixed(1)}%。了解自己的节奏，比单纯减少支出更重要。</p></div><span className="insight-en">A LITTLE<br/>PERSPECTIVE ↗</span></div><div className="page-end"><span>FINPLOT / YOUR MONEY, WITH MEANING</span><span>找到属于自己的平衡。</span></div></>
}
function CalendarPage() {
  const { year, month, setMonth, setYear } = useApp(); const [selected, setSelected] = useState(28)
  const first = (new Date(year,month-1,1).getDay()+6)%7, count = new Date(year,month,0).getDate()
  const cells = Array.from({length: Math.ceil((first+count)/7)*7},(_,i) => i-first+1)
  const days = ['一','二','三','四','五','六','日']
  const transactions = monthTransactions(year, month)
  const chosen = transactions.filter(t => t.day === selected)
  const step = (amount) => { const next = month + amount; if (next < 1) { if (year <= 2024) return; setMonth(12); setYear(year-1) } else if(next > 12) { if (year >= 2025) return; setMonth(1); setYear(year+1) } else setMonth(next); setSelected(1) }
  return <><div className="page-intro"><div><div className="eyebrow"><span>03 / CALENDAR</span><i/><span>THE RHYTHM OF LIFE</span></div><h1>收支日历<span className="heading-period">.</span></h1><p>在日子里看见数字，也在数字里记住日子。</p></div><div className="intro-actions"><PeriodControls allowMode={false}/></div></div><SectionHeading title="生活的每一天" meta="选择日期查看交易"/><div className="calendar-layout"><Card className="calendar-card"><div className="calendar-heading"><div><h3>{year} 年 {month} 月</h3><p>所有值得记录的日常</p></div><div className="calendar-arrows"><Button variant="outline" size="icon" onClick={() => step(-1)} disabled={year===2024 && month===1} aria-label="上个月"><ChevronLeft size={16}/></Button><Button variant="outline" size="icon" onClick={() => step(1)} disabled={year===2025 && month===12} aria-label="下个月"><ChevronRight size={16}/></Button></div></div><div className="calendar-week">{days.map(d => <span key={d}>周{d}</span>)}</div><div className="calendar-grid">{cells.map((day,i) => { const valid=day>0&&day<=count; const transaction=valid?transactions.find(t=>t.day===day):null; return <button key={i} disabled={!valid} className={`calendar-cell ${selected===day&&valid?'selected':''}`} onClick={() => setSelected(day)}><span>{valid ? day : ''}</span>{transaction && <small className={transaction.amount > 0 ? 'calendar-positive' : ''}>{transaction.amount>0?'+':'−'}{money(Math.abs(transaction.amount))}</small>}{transaction && <i/>}</button> })}</div><div className="calendar-caption"><span><i/> 有交易的日期</span><span>展示部分示例交易</span></div></Card><Card className="day-card"><div className="day-card-top"><span>SELECTED DAY</span><div className="day-number">{String(selected).padStart(2,'0')}<span> / {String(month).padStart(2,'0')}</span></div><p>{year} 年 {month} 月 {selected} 日</p></div><div className="day-divider"/><h3>当日交易 <span>{chosen.length}</span></h3>{chosen.length ? chosen.map(t => <div className="transaction-row" key={t.name}><TransactionIcon type={t.icon}/><div><strong>{t.name}</strong><span>{t.category}</span></div><b className={t.amount>0?'amount-positive':''}>{t.amount>0?'+':'−'}{money(Math.abs(t.amount))}</b></div>) : <div className="empty-day"><CalendarDays size={23}/><strong>这一天很安静</strong><span>没有记录示例交易</span></div>}<div className="day-quote">“日子是由一个个<br/>普通的今天组成的。”<span>— FINPLOT NOTES</span></div></Card></div><div className="page-end"><span>FINPLOT / EVERY DAY COUNTS</span><span>每一天，都算数。</span></div></>
}
function Investments() {
  const { year,mode,month } = useApp()
  const investments = investmentData(year)
  const records = investments.filter(t => mode === 'year' || t.month === month)
  const profit = records.filter(t=>t.amount>0).reduce((a,t)=>a+t.amount,0), loss = records.filter(t=>t.amount<0).reduce((a,t)=>a+Math.abs(t.amount),0), net = profit-loss
  const graph = Array.from({length:12},(_,i)=>({name:`${i+1}月`, value: investments.filter(t=>t.month===i+1).reduce((a,t)=>a+t.amount,0)}))
  return <><PageIntro eyebrow="04 / INVESTMENTS" title="投资记录" subtitle="让时间成为朋友，也让每一次选择都有迹可循。"/><SectionHeading title="投资表现" meta={mode === 'year' ? `${year} 年度` : `${year} 年 ${month} 月`}/><div className="investment-metrics"><Card><span>投资盈利 <ArrowUpRight size={15}/></span><strong>{money(profit,2)}</strong><small>已实现盈利及分红</small></Card><Card><span>投资亏损 <ArrowDownRight size={15}/></span><strong>{money(loss,2)}</strong><small>已实现亏损</small></Card><Card className="investment-net"><span>盈亏差额 <Activity size={15}/></span><strong>{net >= 0 ? '+' : '−'}{money(Math.abs(net),2)}</strong><small>{net>0?'本期投资有所收获':net<0?'本期投资有所亏损':'本期暂无盈亏'}</small></Card></div><Card className="investment-chart-card"><div className="card-heading"><div><h3>投资盈亏轨迹</h3><p>以交易发生的月份记录已实现盈亏</p></div><span className="tiny-tag">{year} 全年</span></div><div className="investment-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={graph} margin={{top:10,right:10,left:-20,bottom:0}}><defs><linearGradient id="investGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--income)" stopOpacity={0.2}/><stop offset="100%" stopColor="var(--income)" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5"/><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:11}} dy={8}/><YAxis tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:11}}/><Tooltip content={<ChartTooltip/>}/><Area type="monotone" dataKey="value" name="盈亏" stroke="var(--income)" strokeWidth={2.5} fill="url(#investGradient)"/></AreaChart></ResponsiveContainer></div></Card><div className="dashboard-heading"><SectionHeading title="交易明细" meta={`${records.length} 笔交易`}/></div><Card className="investment-table"><div className="table-header"><span>资产</span><span>日期</span><span>交易类型</span><span>已实现盈亏</span></div>{records.length ? records.map((t,i) => <div className="table-row" key={i}><div className="asset-name"><span className="asset-icon"><LineChartIcon size={17}/></span><div><strong>{t.name}</strong><small>{t.code}</small></div></div><span>{year}.{String(t.month).padStart(2,'0')}.{String(t.day).padStart(2,'0')}</span><span><Badge>{t.action}</Badge></span><strong className={t.amount>0?'amount-positive':''}>{t.amount>0?'+':'−'}{money(Math.abs(t.amount),2)}</strong></div>) : <div className="table-empty">本期没有示例投资交易</div>}</Card><div className="page-end"><span>FINPLOT / THINK LONG TERM</span><span>慢一点，也是一种向前。</span></div></>
}
function Settings() {
  const fileRef = useRef(null); const [file,setFile]=useState(''); const [checked,setChecked]=useState(false)
  return <><PageIntro eyebrow="05 / SETTINGS" title="设置" subtitle="让你的账本，以自己喜欢的方式运转。" controls={false}/><SectionHeading title="账本与应用" meta="PREFERENCES"/><div className="settings-layout"><Card className="settings-card"><div className="settings-title"><span><Database size={19}/></span><div><h3>账本接入</h3><p>连接你的 SQLite 账本</p></div></div><div className="settings-body"><div className="settings-row"><div><strong>SQLite 数据库</strong><p>{file ? `已选择 ${file}，这是演示接入流程。` : '选择本地 .sqlite、.sqlite3 或 .db 文件。'}</p></div><input ref={fileRef} type="file" accept=".sqlite,.sqlite3,.db" hidden onChange={e=>setFile(e.target.files?.[0]?.name||'')}/><Button variant="outline" onClick={()=>fileRef.current?.click()}><FileUp size={15}/>{file?'重新选择':'选择文件'}</Button></div><div className="settings-info"><LockKeyhole size={15}/><span>原型仅展示文件选择流程，不读取或上传文件；页面仍使用示例数据。</span></div></div></Card><Card className="settings-card"><div className="settings-title"><span><RefreshCw size={19}/></span><div><h3>版本更新</h3><p>保持应用的良好状态</p></div></div><div className="settings-body"><div className="settings-row"><div><strong>Finplot 原型 <Badge>v1.0.0</Badge></strong><p>{checked ? '当前为原型演示版本。' : '看见生活的财务全景。'}</p></div><Button variant="outline" onClick={()=>setChecked(true)}>{checked?<Check size={15}/>:<RefreshCw size={15}/>} {checked?'已查看':'检查更新'}</Button></div></div></Card><div className="settings-aside"><Sparkles size={19}/><h3>财务，<br/>可以更从容。</h3><p>好的工具不只是记录数字，<br/>也帮你看见数字背后的生活。</p><span>MADE FOR THE WAY YOU LIVE ↗</span></div></div><div className="page-end"><span>FINPLOT / MADE WITH INTENTION</span><span>感谢你来到这里。</span></div></>
}
export default function App() {
  const { page } = useApp()
  const reducedMotion = useReducedMotion()
  const content = { overview:<Overview/>, analysis:<Analysis/>, calendar:<CalendarPage/>, investments:<Investments/>, settings:<Settings/> }
  return <div className="app"><div className="workspace"><Sidebar/><div className="app-main"><Header/><main className="main-scroll"><AnimatePresence mode="wait"><motion.div className="page-content" key={page} initial={reducedMotion ? false : {opacity:0,y:7}} animate={{opacity:1,y:0}} exit={reducedMotion ? {opacity:1} : {opacity:0,y:-5}} transition={{duration:reducedMotion ? 0 : .2,ease:'easeOut'}}>{content[page]}</motion.div></AnimatePresence></main></div></div></div>
}
