import React, { useEffect, useRef, useState } from 'react'
import { version as appVersion } from '../package.json'
import { AnimatePresence, motion } from 'motion/react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ResizablePanel as Panel, ResizablePanelGroup as PanelGroup, ResizableHandle as PanelResizeHandle } from '@/components/ui/resizable'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { Activity, ArrowDownLeft, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Coffee, Database, Download, Ellipsis, FileUp, Grip, Home, LayoutDashboard, LineChart as LineChartIcon, LockKeyhole, RefreshCw, Settings2, ShoppingBag, SlidersHorizontal, Sparkles, TrainFront, TrendingUp, Wallet } from 'lucide-react'
import { Button, Card, Badge, MetricCard, PeriodDropdown, SectionHeading, SegmentedControl } from './components/ui'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { financialChartConfig, withChartColors } from './design-system/chart'
import { useReducedMotionPreference } from './design-system/motion'
import { useApp } from './store'
import { money, percent, useFinance } from './finance'
import { dailySummaries, NATURES, previousPeriodTotals, selectTransactions, summaryCsv, summarize } from './lib/ledger'
import { clearLedgerCache, importLedgerFile, restoreLedgerCache, saveLedgerCache } from './lib/ledger-file'

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
  const { page, setPage, ledger } = useApp()
  return <aside className="sidebar">
    <Logo />
    <div className="sidebar-label">WORKSPACE <span>工作空间</span></div>
    <nav className="side-nav" aria-label="主导航">
      {nav.map(({ id, label, icon: Icon }) => <Button variant="ghost" key={id} onClick={() => setPage(id)} aria-label={label} className={`nav-item ${page === id ? 'active' : ''}`}><Icon size={17} strokeWidth={1.7}/><span>{label}</span>{page === id && <i/>}</Button>)}
    </nav>
    <div className="sidebar-label lower-label">PREFERENCES <span>偏好设置</span></div>
    <Button variant="ghost" onClick={() => setPage('settings')} aria-label="设置" className={`nav-item ${page === 'settings' ? 'active' : ''}`}><Settings2 size={17} strokeWidth={1.7}/><span>设置</span>{page === 'settings' && <i/>}</Button>
    <div className="sidebar-spacer" />
    <div className="side-note"><div className="side-note-top"><Sparkles size={15}/><span>A LITTLE REMINDER</span></div><p>每一个小小的决定，<br/>都在塑造你的未来。</p><div className="side-note-line"><span>为生活，留一份从容</span><ArrowUpRight size={14}/></div></div>
    <div className="profile"><Avatar className="avatar"><AvatarFallback className="avatar-fallback">{ledger ? '我' : '林'}</AvatarFallback></Avatar><div><strong>{ledger ? '我的账本' : '林小满 · 示例'}</strong><span>我的个人账本</span></div><Ellipsis size={18}/></div>
    <div className="side-footer">PERSONAL FINANCE<span>v{appVersion}</span></div>
  </aside>
}
function DataDialog() {
  const { ledger, ledgerLoading, setPage } = useApp()
  return <Dialog><DialogTrigger asChild><Button variant="ghost" className="data-status"><span/>{ledgerLoading ? '读取账本中…' : ledger ? '本地账本' : '示例数据'} <CircleHelp size={13}/></Button></DialogTrigger><DialogContent><div className="dialog-icon"><Database size={20}/></div><DialogTitle>{ledger ? '当前账本' : '接入你的账本'}</DialogTitle><DialogDescription>{ledger ? `${ledger.filename} · ${ledger.transactions.length.toLocaleString('zh-CN')} 笔交易。${ledger.cutoff ? `最新交易：${ledger.cutoff}。` : '账本尚无交易。'} 数据仅在当前浏览器读取并保存，原始文件保持不变。` : '当前展示虚构示例数据。在设置中选择 StaffX SQLite 账本，即可查看真实收支。'}</DialogDescription><DialogFooter className="dialog-footer"><DialogClose asChild><Button onClick={() => setPage('settings')}>{ledger ? '管理账本' : '选择账本'}</Button></DialogClose></DialogFooter></DialogContent></Dialog>
}
function Header() {
  const { page, ledger } = useApp()
  return <header className="app-header"><div className="breadcrumbs"><span>我的账本</span><ChevronRight size={13}/><strong>{pageLabels[page]}</strong></div><div className="header-right"><DataDialog/><span className="header-divider"/><span className="header-date">让数字，回到生活</span><Avatar className="header-avatar"><AvatarFallback className="avatar-fallback">{ledger ? '我' : '林'}</AvatarFallback></Avatar></div></header>
}
function PeriodControls({ allowMode = true }) {
  const { year, setYear, month, setMonth, mode, setMode, ledger } = useApp()
  const years = ledger?.years.length ? Array.from({ length: ledger.years[0] - ledger.years.at(-1) + 1 }, (_, i) => ledger.years[0] - i) : ledger ? [year] : [2025, 2024]
  return <div className="period-controls">
    {allowMode && <SegmentedControl label="时间范围" value={mode} onValueChange={setMode} options={[{ value: 'year', label: '年度' }, { value: 'month', label: '月度' }]}/>}
    <PeriodDropdown label="选择年份" value={year} onValueChange={setYear} options={years.map(value => ({ value, label: `${value} 年` }))}/>
    {(!allowMode || mode === 'month') && <PeriodDropdown label="选择月份" value={month} onValueChange={setMonth} options={Array.from({length:12}, (_,i) => ({value: i+1, label: `${i+1} 月`}))}/>}
  </div>
}
function ScopeControls() {
  const { ledger, nature, setNature } = useApp()
  return ledger ? <PeriodDropdown label="统计口径" value={nature} onValueChange={setNature} options={[{ value: 'all', label: '全部性质' }, ...NATURES.map(value => ({ value, label: value }))]}/> : null
}
function CoverageNote({ investment = false }) {
  const { ledger, nature } = useApp()
  if (!ledger) return null
  return <p className="coverage-note">{ledger.firstDate ? `账本记录：${ledger.firstDate} 至 ${ledger.lastDate}` : '账本尚无交易'} · {investment ? '仅投资性质' : nature === 'all' ? '全部性质（含投资、往来与调整）' : `仅${nature}性质`} · 金额单位：人民币元</p>
}
function exportData(rows, year, mode, month, nature, ledger) {
  const csv = summaryCsv(rows.filter(d => mode === 'year' || d.month === month), year, nature, ledger ? 'ledger' : 'demo')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = `finplot-${year}${mode === 'month' ? '-' + String(month).padStart(2,'0') : ''}-${nature === 'all' ? '全部' : nature}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function PageIntro({ eyebrow, title, subtitle, controls = true, exportButton = false, scope = true }) {
  const { year, month, mode, nature, ledger } = useApp()
  const { yearData } = useFinance()
  return <><div className="page-intro"><div><div className="eyebrow"><span>{eyebrow}</span><i/> <span>YOUR MONEY, IN PERSPECTIVE</span></div><h1>{title}<span className="heading-period">.</span></h1><p>{subtitle}</p></div><div className="intro-actions">{controls && <><PeriodControls/>{scope && <ScopeControls/>}</>}{exportButton && <Button variant="outline" onClick={() => exportData(yearData(year),year,mode,month,nature,ledger)}><Download size={15}/> 导出报表</Button>}</div></div>{controls && <CoverageNote investment={!scope}/>}</>
}
function SortableMetric({ id, data, previous, period }) {
  const reducedMotion = useReducedMotionPreference()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    transition: reducedMotion ? null : undefined,
    animateLayoutChanges: reducedMotion ? () => false : undefined,
  })
  const values = {
    income: { label: '总收入', value: money(data.income, 2), icon: ArrowDownLeft, note: '为生活创造更多可能', tone: 'income' },
    expense: { label: '总支出', value: money(data.expense, 2), icon: ArrowUpRight, note: '认真生活的每一笔', tone: 'expense' },
    balance: { label: '收支结余', value: money(data.balance, 2), icon: Wallet, note: data.available === false ? '账本未覆盖本期' : data.count === 0 ? '本期暂无交易' : data.balance > 0 ? '盈余 · 收入超过支出' : data.balance < 0 ? '超支 · 支出超过收入' : '平衡 · 收支恰好相等', tone: 'balance' },
    rate: { label: '结余率', value: data.rate == null ? '—' : `${data.rate.toFixed(1)}%`, icon: Activity, note: data.rate == null ? '本期无收入，结余率不适用' : '收入中被留下的部分', tone: 'rate' },
  }
  const item = values[id]; const Icon = item.icon
  const comparable = previous && (previous.count == null || previous.count > 0) && (id === 'rate' ? data.rate != null && previous.rate != null : previous[id] !== 0)
  const change = comparable ? (id === 'rate' ? data.rate - previous.rate : (data[id] - previous[id]) / Math.abs(previous[id]) * 100) : null
  const favorable = id === 'expense' ? change <= 0 : change >= 0
  const changeText = change == null ? undefined : id === 'rate' ? `${change >= 0 ? '+' : ''}${change.toFixed(1)} 个百分点` : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 3 : undefined }} className={`metric-wrap ${isDragging ? 'dragging' : ''}`}><MetricCard label={item.label} value={item.value} icon={Icon} tone={item.tone} change={changeText} comparison={comparable ? previous?.label ?? period : undefined} favorable={favorable} status={data.available === false ? '账本未覆盖本期' : id === 'balance' || (id === 'rate' && data.rate == null) ? item.note : comparable ? undefined : '暂无可比的去年同期记录'} action={<Button variant="ghost" size="icon" className="drag-handle" {...attributes} {...listeners} aria-label={`拖动调整${item.label}卡片顺序`}><Grip size={15}/></Button>}/></div>
}
function TrendCard({ data }) {
  const reducedMotion = useReducedMotionPreference()
  return <Card className="chart-card trend-card"><div className="card-heading"><div><div className="card-title-row"><h3>收支趋势</h3><span className="tiny-tag">全年</span></div><p>收入与支出，随时间的变化</p></div></div>
    <div className="trend-chart"><ChartContainer config={financialChartConfig} className="finplot-chart"><LineChart data={data} margin={{top:0,right:8,left:-20,bottom:0}}><ChartLegend verticalAlign="top" align="right" content={<ChartLegendContent className="financial-chart-legend"/>}/><CartesianGrid stroke="var(--chart-grid)" vertical={false} strokeDasharray="3 5"/><XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} tick={{fill:'var(--muted)',fontSize:11}} dy={10}/><YAxis tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:11}} tickFormatter={v => v === 0 ? '0' : `${v/10000}万`} domain={[0, 'auto']}/><ChartTooltip isAnimationActive={!reducedMotion} content={<ChartTooltipContent className="financial-chart-tooltip" valueFormatter={money}/>} cursor={{stroke:'var(--border)',strokeDasharray:'3 4'}}/><Line isAnimationActive={!reducedMotion} type="monotone" dataKey="income" name="收入" stroke="var(--income)" strokeWidth={2.6} dot={false} activeDot={{r:5,stroke:'var(--card)',strokeWidth:3}}/><Line isAnimationActive={!reducedMotion} type="monotone" dataKey="expense" name="支出" stroke="var(--expense)" strokeWidth={2.3} dot={false} activeDot={{r:5,stroke:'var(--card)',strokeWidth:3}}/></LineChart></ChartContainer></div>
    <div className="chart-footnote"><span><Sparkles size={14}/> 每一笔收支，都让未来的轮廓更清晰。</span><span>金额单位：人民币</span></div>
  </Card>
}
function BreakdownCard({ data }) {
  const { categories } = useFinance()
  const reducedMotion = useReducedMotionPreference()
  const [type, setType] = useState('expense')
  const items = withChartColors(categories(type, data[type], 'group'))
  return <Card className="chart-card breakdown-card"><div className="card-heading"><div><h3>收支构成</h3><p>看看钱从哪里来，去了哪里</p></div><SegmentedControl compact label="收支构成" value={type} onValueChange={setType} options={[{ value: 'expense', label: '支出' }, { value: 'income', label: '收入' }]}/></div>
    <div className="donut-layout"><div className="donut-wrap"><ChartContainer config={financialChartConfig} className="finplot-chart"><PieChart><Pie isAnimationActive={!reducedMotion} data={items} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="94%" paddingAngle={3} stroke="none" cornerRadius={3}>{items.map(item => <Cell key={item.name} fill={item.color}/>)}</Pie><ChartTooltip isAnimationActive={!reducedMotion} content={<ChartTooltipContent className="financial-chart-tooltip" valueFormatter={money} hideLabel/>}/></PieChart></ChartContainer><div className="donut-center"><span>总{type === 'expense' ? '支出' : '收入'}</span><strong>{money(data[type])}</strong></div></div><div className="donut-legend">{items.map(item => <div key={item.name}><span><i style={{background:item.color}}/>{item.name}</span><strong>{percent(item.share)}%</strong></div>)}</div></div>
    <div className="breakdown-footer"><span>占比最高</span><strong>{items[0]?.name ?? '暂无记录'}</strong><span>{items.length ? money(items[0].value) : '—'}</span></div>
  </Card>
}
function BalanceCard({ data }) {
  const reducedMotion = useReducedMotionPreference()
  const highest = data.filter(row => row.count !== 0 && row.balance != null).reduce((best, row) => !best || row.balance > best.balance ? row : best, null)
  return <Card className="chart-card balance-card"><div className="card-heading"><div><h3>逐月结余</h3><p>每个月留下的，都是向前的底气</p></div><div className="balance-highlight"><span>最佳月份</span><strong>{highest ? `${highest.month} 月` : '暂无记录'} <em>{highest ? money(highest.balance) : '—'}</em></strong></div></div><div className="balance-chart"><ChartContainer config={financialChartConfig} className="finplot-chart"><BarChart data={data} margin={{top:8,right:4,left:-24,bottom:0}}><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5"/><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:10}} dy={8}/><YAxis tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:10}} tickFormatter={v => v === 0 ? '0' : `${v/10000}万`}/><ChartTooltip isAnimationActive={!reducedMotion} content={<ChartTooltipContent className="financial-chart-tooltip" valueFormatter={money}/>} cursor={{fill:'var(--hover)'}}/><Bar isAnimationActive={!reducedMotion} dataKey="balance" name="结余" fill="var(--income)" radius={[5,5,0,0]} maxBarSize={22}>{data.map((d,i) => <Cell key={i} fill={d.balance < 0 ? 'var(--negative)' : d.month === highest?.month ? 'var(--income)' : 'var(--bar-soft)'}/>)}</Bar></BarChart></ChartContainer></div></Card>
}
function TransactionIcon({ type }) { const Icon = iconMap[type] || ShoppingBag; return <span className={`transaction-icon ${type}`}><Icon size={16} strokeWidth={1.7}/></span> }
function RecentCard({ month, year, onView }) {
  const { monthTransactions } = useFinance()
  const { ledger, mode, nature, setPeriod, setCalendarDay } = useApp()
  const transactions = ledger && mode === 'year' ? selectTransactions(ledger, { year, nature }) : monthTransactions(year, month)
  return <Card className="chart-card recent-card"><div className="card-heading"><div><h3>最近的生活</h3><p>{year} 年 {mode === 'month' || !ledger ? `${month} 月 · ` : '· '}{ledger ? '最近交易' : '部分示例交易'}</p></div><Button variant="ghost" className="text-link" onClick={() => { if (ledger && transactions[0]) { setPeriod(year, transactions[0].month); setCalendarDay(transactions[0].day) } onView() }}>查看日历 <ArrowRight size={14}/></Button></div><div className="transaction-list">{transactions.slice(0,4).map(t => <div className="transaction-row" key={t.id}><TransactionIcon type={t.icon}/><div><strong>{t.name}</strong><span>{t.month ?? month}月{t.day}日 · {t.category}</span></div><b className={t.amount > 0 ? 'amount-positive' : ''}>{t.amount > 0 ? '+' : '−'}{money(Math.abs(t.amount))}</b></div>)}{!transactions.length && <div className="empty-day">本期暂无交易记录</div>}</div></Card>
}
function Overview() {
  const { year, mode, month, metricOrder, setMetricOrder, setPage, ledger, nature } = useApp()
  const { totals, yearData } = useFinance()
  const data = totals(year,mode,month), previous = ledger ? previousPeriodTotals(ledger,year,mode,month,nature) : totals(year-1,mode,month), series = yearData(year)
  const narrow = useNarrowScreen()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const onDragEnd = ({ active, over }) => { if (over && active.id !== over.id) setMetricOrder(arrayMove(metricOrder, metricOrder.indexOf(active.id), metricOrder.indexOf(over.id))) }
  return <><PageIntro eyebrow="01 / OVERVIEW" title="财务总览" subtitle={ledger ? '从真实记录中，看见收支的变化。' : '你好，小满。让我们一起看看，你的生活正在如何生长。'} exportButton/>
    <SectionHeading title="你的财务概览" meta={mode === 'year' ? `${year} 年度` : `${year} 年 ${month} 月`} action={<span className="section-hint"><Grip size={14}/> 拖动卡片调整顺序</span>}/>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}><SortableContext items={metricOrder} strategy={rectSortingStrategy}><div className="metrics-grid">{metricOrder.map(id => <SortableMetric key={id} id={id} data={data} previous={previous} period="去年同期"/>)}</div></SortableContext></DndContext>
    <div className="dashboard-heading"><SectionHeading title="看见变化" meta="THE BIG PICTURE" action={<span className="section-hint resize-hint">拖动中间分隔线调整宽度</span>}/></div>
    {narrow ? <div className="mobile-charts"><TrendCard data={series}/><BreakdownCard data={data}/></div> : <div className="desktop-charts"><PanelGroup direction="horizontal" autoSaveId="finplot-panels"><Panel defaultSize={65} minSize={48}><TrendCard data={series}/></Panel><PanelResizeHandle className="resize-handle"><span/></PanelResizeHandle><Panel defaultSize={35} minSize={30}><BreakdownCard data={data}/></Panel></PanelGroup></div>}
    <div className="lower-grid"><BalanceCard data={series}/><RecentCard year={year} month={month} onView={() => setPage('calendar')}/></div>
    <div className="page-end"><span>FINPLOT / A CLEARER PICTURE OF YOUR MONEY</span><span>用心生活，也用心记录。 ✳</span></div>
  </>
}
function CategoryBlock({ type, amount, level }) {
  const { categories } = useFinance()
  const reducedMotion = useReducedMotionPreference()
  const items = withChartColors(categories(type,amount,level))
  const isIncome = type === 'income'
  return <Card className="category-card"><div className="category-head"><div><div className={`category-icon ${type}`}>{isIncome ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}</div><div><span>{isIncome ? 'MONEY IN' : 'MONEY OUT'}</span><h3>{isIncome ? '收入构成' : '支出构成'}</h3></div></div><strong>{money(amount,2)}</strong></div><div className="category-visual"><div className="analysis-donut"><ChartContainer config={financialChartConfig} className="finplot-chart"><PieChart><Pie isAnimationActive={!reducedMotion} data={items} dataKey="value" nameKey="name" innerRadius="70%" outerRadius="94%" paddingAngle={3} stroke="none" cornerRadius={3}>{items.map(i => <Cell key={i.name} fill={i.color}/>)}</Pie><ChartTooltip isAnimationActive={!reducedMotion} content={<ChartTooltipContent className="financial-chart-tooltip" valueFormatter={money} hideLabel/>}/></PieChart></ChartContainer><div className="donut-center"><span>{isIncome ? '收入分类' : '支出分类'}</span><strong>{items.length} 类</strong></div></div><div className="category-insight"><span>最大{isIncome ? '收入来源' : '支出项目'}</span><strong>{items[0]?.name ?? '暂无记录'}</strong><p>占总{isIncome ? '收入' : '支出'}的 {percent(items[0]?.share ?? 0)}%</p></div></div><div className="category-table-head"><span>分类</span><span>金额 / 占比</span></div>{items.map(item => <div className="category-row" key={item.name}><div><i style={{background:item.color}}/><span>{item.name}{level === 'category' && item.group && <small className="category-detail">{item.group} · {item.nature}{item.active ? '' : ' · 历史停用'}</small>}</span></div><div><strong>{money(item.value)}</strong><span>{percent(item.share)}%</span></div><div className="category-progress"><span style={{width:`${item.share*100}%`,background:item.color}}/></div></div>)}</Card>
}
function Analysis() {
  const { year,mode,month,ledger } = useApp(); const { totals } = useFinance(); const data = totals(year,mode,month)
  const [level, setLevel] = useState('category')
  return <><PageIntro eyebrow="02 / ANALYSIS" title="收支分析" subtitle="把数字拆开来看，生活的偏好也渐渐清晰。" exportButton/><SectionHeading title="每一笔的去向" meta={mode === 'year' ? `${year} 年度` : `${year} 年 ${month} 月`} action={ledger && <SegmentedControl label="分类层级" value={level} onValueChange={setLevel} options={[{value:'category',label:'分类'},{value:'group',label:'分组'}]}/>}/><div className="analysis-grid"><CategoryBlock type="income" amount={data.income} level={level}/><CategoryBlock type="expense" amount={data.expense} level={level}/></div><div className="insight-banner"><span className="insight-spark"><Sparkles size={19}/></span><div><strong>一点值得留意的事</strong><p>{data.rate == null ? '本期没有收入记录，结余率不适用。' : `本期收支结余为 ${money(data.balance)}，结余率 ${data.rate.toFixed(1)}%。`}</p></div><span className="insight-en">A LITTLE<br/>PERSPECTIVE ↗</span></div><div className="page-end"><span>FINPLOT / YOUR MONEY, WITH MEANING</span><span>找到属于自己的平衡。</span></div></>
}
function CalendarPage() {
  const { year, month, calendarDay: selected, setCalendarDay: setSelected, setPeriod, ledger } = useApp()
  const { monthTransactions } = useFinance()
  const first = (new Date(year,month-1,1).getDay()+6)%7, count = new Date(year,month,0).getDate()
  const cells = Array.from({length: Math.ceil((first+count)/7)*7},(_,i) => i-first+1)
  const transactions = monthTransactions(year, month)
  const chosen = transactions.filter(t => t.day === selected)
  const daily = dailySummaries(transactions)
  const minYear = ledger?.years.at(-1) ?? (ledger ? year : 2024)
  const maxYear = ledger?.years[0] ?? (ledger ? year : 2025)
  const step = (amount) => {
    const next = new Date(year, month - 1 + amount, 1)
    if (next.getFullYear() < minYear || next.getFullYear() > maxYear) return
    setPeriod(next.getFullYear(), next.getMonth() + 1)
  }
  return <>
    <div className="page-intro"><div><div className="eyebrow"><span>03 / CALENDAR</span></div><h1>收支日历<span className="heading-period">.</span></h1><p>在日子里看见数字，也在数字里记住日子。</p></div><div className="intro-actions"><PeriodControls allowMode={false}/><ScopeControls/></div></div>
    <CoverageNote/>
    <SectionHeading title="生活的每一天" meta="选择日期查看交易"/>
    <div className="calendar-layout"><Card className="calendar-card">
      <div className="calendar-heading"><div><h3>{year} 年 {month} 月</h3><p>当日收支合计</p></div><div className="calendar-arrows"><Button variant="outline" size="icon" onClick={() => step(-1)} disabled={year===minYear && month===1} aria-label="上个月"><ChevronLeft size={16}/></Button><Button variant="outline" size="icon" onClick={() => step(1)} disabled={year===maxYear && month===12} aria-label="下个月"><ChevronRight size={16}/></Button></div></div>
      <div className="calendar-week">{['一','二','三','四','五','六','日'].map(d => <span key={d}>周{d}</span>)}</div>
      <div className="calendar-grid">{cells.map((day,i) => {
        const valid = day > 0 && day <= count, summary = valid ? daily.get(day) : null
        const label = valid ? `${month}月${day}日，${summary ? `${summary.count}笔交易，收入${money(summary.income)}，支出${money(summary.expense)}` : '暂无交易'}` : undefined
        return <Button variant="ghost" key={i} disabled={!valid} aria-label={label} aria-pressed={valid ? selected===day : undefined} className={`calendar-cell ${selected===day&&valid?'selected':''}`} onClick={() => setSelected(day)}>
          <span>{valid ? day : ''}</span>{summary?.incomeCents > 0 && <small className="calendar-positive" title={`收入 ${money(summary.income)}`}>+{money(summary.income)}</small>}{summary?.expenseCents > 0 && <small title={`支出 ${money(summary.expense)}`}>−{money(summary.expense)}</small>}{summary && <i/>}
        </Button>
      })}</div>
      <div className="calendar-caption"><span><i/> 有交易的日期</span><span>{ledger ? `${transactions.length} 笔交易 · 收入 + / 支出 −` : '部分示例交易'}</span></div>
    </Card><Card className="day-card"><div className="day-card-top"><span>SELECTED DAY</span><div className="day-number">{String(selected).padStart(2,'0')}<span> / {String(month).padStart(2,'0')}</span></div><p>{year} 年 {month} 月 {selected} 日</p></div><div className="day-divider"/><h3>当日交易 <span>{chosen.length}</span></h3>{daily.has(selected) && <div className="day-totals"><span>收入 +{money(daily.get(selected).income)}</span><span>支出 −{money(daily.get(selected).expense)}</span></div>}
      {chosen.length ? chosen.map(t => <div className="transaction-row" key={t.id}><TransactionIcon type={t.icon}/><div><strong>{t.name}</strong><span>{t.occurredAt?.slice(11,16)} {t.category}{t.nature && ` · ${t.nature}`}</span>{t.tags?.length > 0 && <span className="transaction-tags">{t.tags.map(tag => tag.name).join(' · ')}</span>}</div><b className={t.amount>0?'amount-positive':''}>{t.amount>0?'+':'−'}{money(Math.abs(t.amount))}</b></div>) : <div className="empty-day"><CalendarDays size={23}/><strong>暂无交易记录</strong><span>当前日期及统计口径下没有交易</span></div>}
    </Card></div><div className="page-end"><span>FINPLOT / EVERY DAY COUNTS</span><span>每一天，都算数。</span></div>
  </>
}
function Investments() {
  const reducedMotion = useReducedMotionPreference()
  const { year,mode,month,ledger } = useApp()
  const { investmentData } = useFinance()
  const investments = investmentData(year)
  const records = investments.filter(t => mode === 'year' || t.month === month)
  const { income: profit, expense: loss, balance: net } = summarize(records)
  const graph = Array.from({length:12},(_,i) => {
    const key = `${year}-${String(i+1).padStart(2,'0')}`
    const available = !ledger || (ledger.firstDate && key >= ledger.firstDate.slice(0,7) && key <= ledger.lastDate.slice(0,7))
    return {name:`${i+1}月`, value: available ? summarize(investments.filter(t => t.month===i+1)).balance : null}
  })
  return <><PageIntro eyebrow="04 / INVESTMENTS" title="投资记录" subtitle="查看账本中记录的投资收益与亏损。" scope={false}/><SectionHeading title="投资收支" meta={mode === 'year' ? `${year} 年度` : `${year} 年 ${month} 月`}/>
    <div className="investment-metrics"><Card><span>投资收入 <ArrowUpRight size={15}/></span><strong>{money(profit)}</strong><small>投资性质的收入记录</small></Card><Card><span>投资支出 <ArrowDownRight size={15}/></span><strong>{money(loss)}</strong><small>投资性质的支出记录</small></Card><Card className="investment-net"><span>投资净额 <Activity size={15}/></span><strong>{net >= 0 ? '+' : '−'}{money(Math.abs(net))}</strong><small>{net>0?'收入超过支出':net<0?'支出超过收入':'收支相等'}</small></Card></div>
    {ledger && <p className="coverage-note investment-note">按分类性质“投资”汇总。账本未提供持仓、成本或买卖类型，不计算收益率。</p>}
    <Card className="investment-chart-card"><div className="card-heading"><div><h3>逐月投资净额</h3><p>收入减去支出 · 人民币元</p></div><span className="tiny-tag">{year} 全年</span></div><div className="investment-chart"><ChartContainer config={financialChartConfig} className="finplot-chart"><AreaChart data={graph} margin={{top:10,right:10,left:-20,bottom:0}}><defs><linearGradient id="investGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--income)" stopOpacity={0.2}/><stop offset="100%" stopColor="var(--income)" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5"/><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:11}} dy={8}/><YAxis tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:11}}/><ChartTooltip isAnimationActive={!reducedMotion} content={<ChartTooltipContent className="financial-chart-tooltip" valueFormatter={money}/>}/><Area isAnimationActive={!reducedMotion} type="monotone" dataKey="value" name="投资净额" stroke="var(--income)" strokeWidth={2.5} fill="url(#investGradient)"/></AreaChart></ChartContainer></div></Card>
    <div className="dashboard-heading"><SectionHeading title="交易明细" meta={`${records.length} 笔交易`}/></div><Card className="investment-table"><Table className="investment-data-table"><TableHeader><TableRow className="table-header"><TableHead scope="col">{ledger ? '备注 / 分类' : '资产 · 示例'}</TableHead><TableHead scope="col">日期</TableHead><TableHead scope="col">方向</TableHead><TableHead scope="col">金额（元）</TableHead></TableRow></TableHeader><TableBody>{records.length ? records.map(t => <TableRow className="table-row" key={t.id}><TableCell><div className="asset-name"><span className="asset-icon"><LineChartIcon size={17}/></span><div><strong>{t.name}</strong><small>{ledger ? t.category : t.code}</small>{t.tags?.length > 0 && <small>{t.tags.map(tag => tag.name).join(' · ')}</small>}</div></div></TableCell><TableCell>{year}.{String(t.month).padStart(2,'0')}.{String(t.day).padStart(2,'0')}</TableCell><TableCell><Badge>{t.direction}</Badge></TableCell><TableCell><strong className={t.amount>0?'amount-positive':''}>{t.amount>0?'+':'−'}{money(Math.abs(t.amount))}</strong></TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="table-empty">本期没有投资记录</TableCell></TableRow>}</TableBody></Table></Card><div className="page-end"><span>FINPLOT / THINK LONG TERM</span><span>慢一点，也是一种向前。</span></div></>
}
function Settings() {
  const fileRef = useRef(null)
  const { ledger, ledgerLoading, ledgerError, ledgerNotice, setLedger, clearLedger } = useApp()
  const [checked,setChecked] = useState(false)
  const chooseFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || useApp.getState().ledgerLoading) return
    useApp.setState({ ledgerLoading: true, ledgerError: '', ledgerNotice: '' })
    try {
      const { ledger: next, bytes } = await importLedgerFile(file)
      let notice = ''
      try { await saveLedgerCache(bytes, file.name) }
      catch {
        try { await clearLedgerCache(); notice = '账本已读取，但浏览器无法保存。刷新后请重新选择文件。' }
        catch { notice = '账本仅在本次页面中可用，刷新可能恢复上次账本。请重新选择文件。' }
      }
      setLedger(next)
      useApp.setState({ ledgerNotice: notice || `已读取 ${next.transactions.length.toLocaleString('zh-CN')} 笔交易，并保存在当前浏览器。` })
    } catch (error) { useApp.setState({ ledgerError: `${error.message} 当前账本未更换。` }) }
    finally { useApp.setState({ ledgerLoading: false }) }
  }
  const remove = async () => {
    useApp.setState({ ledgerLoading: true, ledgerError: '' })
    try { await clearLedgerCache(); clearLedger() }
    catch { useApp.setState({ ledgerError: '无法移除浏览器内的副本，请重试。当前账本仍然保留。' }) }
    finally { useApp.setState({ ledgerLoading: false }) }
  }
  return <><PageIntro eyebrow="05 / SETTINGS" title="设置" subtitle="让你的账本，以自己喜欢的方式运转。" controls={false}/><SectionHeading title="账本与应用" meta="PREFERENCES"/>
    <div className="settings-layout"><Card className="settings-card"><div className="settings-title"><span><Database size={19}/></span><div><h3>账本接入</h3><p>StaffX SQLite 账本</p></div></div><div className="settings-body"><div className="settings-row"><div><strong>{ledger ? ledger.filename : 'SQLite 数据库'}</strong><p>{ledger ? `${ledger.transactions.length.toLocaleString('zh-CN')} 笔交易 · 收入 ${ledger.incomeCount} 笔 · 支出 ${ledger.expenseCount} 笔` : '选择本地 .sqlite、.sqlite3 或 .db 快照（最大 100 MB）。'}{ledger?.cutoff && <><br/>最新交易：{ledger.cutoff}</>}</p></div><input ref={fileRef} aria-label="选择 SQLite 账本" type="file" accept=".sqlite,.sqlite3,.db" hidden onChange={chooseFile}/><Button variant="outline" disabled={ledgerLoading} onClick={()=>fileRef.current?.click()}><FileUp size={15}/>{ledgerLoading ? '读取中…' : ledger ? '更换账本' : '选择文件'}</Button></div>
      {ledgerError && <p role="alert" className="ledger-message ledger-error">{ledgerError}</p>}{ledgerNotice && <p role="status" className="ledger-message">{ledgerNotice}</p>}
      <div className="settings-info"><LockKeyhole size={15}/><span>在本机浏览器读取并保存副本，不上传、不修改原文件。快照不会自动更新；有新备份时请更换账本。JSON 清单不能代替数据库。</span></div>
      {ledger && <div className="ledger-remove"><Button variant="ghost" disabled={ledgerLoading} onClick={remove}>移除本机副本，返回示例</Button></div>}
    </div></Card><Card className="settings-card"><div className="settings-title"><span><RefreshCw size={19}/></span><div><h3>版本信息</h3><p>Finplot</p></div></div><div className="settings-body"><div className="settings-row"><div><strong>Finplot <Badge>v{appVersion}</Badge></strong><p>{checked ? '此版本未接入自动更新服务。' : '看见生活的财务全景。'}</p></div><Button variant="outline" onClick={()=>setChecked(true)}>{checked?<Check size={15}/>:<RefreshCw size={15}/>} {checked?'已查看':'查看版本'}</Button></div></div></Card><div className="settings-aside"><Sparkles size={19}/><h3>财务，<br/>可以更从容。</h3><p>好的工具不只是记录数字，<br/>也帮你看见数字背后的生活。</p><span>MADE FOR THE WAY YOU LIVE ↗</span></div></div><div className="page-end"><span>FINPLOT / MADE WITH INTENTION</span><span>感谢你来到这里。</span></div></>
}
export default function App() {
  const { page, ledgerLoading, ledgerError, setPage } = useApp()
  useEffect(() => {
    let cancelled = false
    restoreLedgerCache().then(ledger => {
      if (!cancelled && ledger) useApp.getState().setLedger(ledger)
    }).catch(() => {
      if (!cancelled) useApp.setState({ ledgerError: '未能恢复本机账本，请在设置中重新选择数据库。当前显示示例数据。' })
    }).finally(() => { if (!cancelled) useApp.setState({ ledgerLoading: false }) })
    return () => { cancelled = true }
  }, [])
  const reducedMotion = useReducedMotionPreference()
  const content = { overview:<Overview/>, analysis:<Analysis/>, calendar:<CalendarPage/>, investments:<Investments/>, settings:<Settings/> }
  return <div className="app"><div className="workspace"><Sidebar/><div className="app-main"><Header/><main className="main-scroll">{ledgerError && page !== 'settings' && <div className="ledger-banner" role="alert">{ledgerError}<Button variant="ghost" onClick={() => setPage('settings')}>管理账本</Button></div>}{ledgerLoading && page !== 'settings' ? <div className="ledger-loading" role="status">正在读取本机账本…</div> : <AnimatePresence mode="wait"><motion.div className="page-content" key={page} initial={reducedMotion ? false : {opacity:0,y:7}} animate={{opacity:1,y:0}} exit={reducedMotion ? {opacity:1} : {opacity:0,y:-5}} transition={{duration:reducedMotion ? 0 : .2,ease:'easeOut'}}>{content[page]}</motion.div></AnimatePresence>}</main></div></div></div>
}
