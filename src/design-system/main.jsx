import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowRight, Download, Layers3, Wallet } from 'lucide-react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { Badge, Button, Card, MetricCard, PeriodDropdown, SectionHeading, SegmentedControl } from '../components/ui'
import { money, yearData } from '../data'
import { chartSeries, financialChartConfig } from './chart'
import { useReducedMotionPreference } from './motion'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import './index.css'
import './gallery.css'

const foundations = [
  { token: '--bg', label: '页面背景' },
  { token: '--card', label: '卡片表面' },
  { token: '--text', label: '主要文字' },
  { token: '--soft-text', label: '次要文字' },
  { token: '--accent', label: '强调蓝' },
  { token: '--hero-bg', label: '轻强调' },
]
const libraries = [
  ['shadcn / Radix', '本地可控的基础组件与无障碍交互'],
  ['Lucide', '统一线性图标与视觉重量'],
  ['Motion', '额外页面与业务动效；不叠加组件自带动效'],
  ['shadcn Chart / Recharts', '图表、数据提示与原生动画'],
  ['shadcn Resizable', '基于 react-resizable-panels 的工作区布局'],
  ['dnd-kit', '支持指针与键盘的拖动排序'],
  ['Zustand', '界面状态与必要的本地持久化'],
]
const modes = [{ value: 'year', label: '年度' }, { value: 'month', label: '月度' }]

function Gallery() {
  const reducedMotion = useReducedMotionPreference()
  const [period, setPeriod] = useState('year')
  const [year, setYear] = useState('2025')
  const [feedback, setFeedback] = useState('')
  useEffect(() => {
    const target = window.location.hash.slice(1)
    if (target) document.getElementById(target)?.scrollIntoView()
  }, [])
  return <div className="guide-shell" id="top">
    <header className="guide-top"><a className="guide-brand" href="/"><span className="guide-mark"><i/><i/><i/><i/></span><span>finplot<strong>.</strong></span></a><div className="guide-top-label">设计系统</div><Button asChild variant="outline"><a href="/">返回应用 <ArrowRight size={14}/></a></Button></header>
    <div className="guide-layout"><aside className="guide-sidebar"><span>目录</span><a href="#principles">设计原则</a><a href="#foundations">视觉基础</a><a href="#components">组件语言</a><a href="#data">数据可视化</a><a href="#libraries">技术与协作</a></aside>
      <main className="guide-content"><div className="guide-hero"><div><h1>让布局说话，<br/><span>让数字清晰。</span></h1><p>为个人财务分析设计的一套视觉与交互语言。</p></div><div className="guide-hero-mark" aria-hidden="true"><span/><span/><span/><span/><span/></div></div>
      <section id="principles" className="guide-section"><SectionHeading title="设计原则"/><div className="principles-grid"><Card className="principle-card"><h3>让布局说明关系</h3><p>用分组、对齐与留白表达关系，省去重复说明。</p></Card><Card className="principle-card"><h3>保留必要信息</h3><p>周期、单位、正负与状态清楚可见。</p></Card><Card className="principle-card"><h3>优先使用 shadcn/ui</h3><p>复用本地组件，需要时引入官方源码。</p></Card></div></section>
      <section id="foundations" className="guide-section"><SectionHeading title="视觉基础"/><div className="foundation-grid"><Card className="guide-card color-card"><div className="guide-card-head"><div><h3>颜色</h3></div><Badge>语义令牌</Badge></div><div className="swatches">{foundations.map(item => <div className="swatch" key={item.token}><div className="swatch-color" style={{background:`var(${item.token})`}}/><strong>{item.label}</strong><code>{item.token}</code></div>)}</div></Card><Card className="guide-card type-card"><div className="guide-card-head"><div><h3>字体与数字</h3></div></div><div className="type-sample"><span>Aa <b>一二三</b></span><strong>¥128,640.00</strong><small>SF PRO / PINGFANG SC · 等宽数字</small></div></Card></div><Card className="guide-card spacing-card"><div className="guide-card-head"><div><h3>间距与圆角</h3></div></div><div className="spacing-row">{['--space-1','--space-2','--space-3','--space-4','--space-6','--space-8'].map(token => <div key={token}><span style={{width:`var(${token})`}}/><code>{token}</code></div>)}<div className="radius-sample"><span/><code>--radius</code></div></div></Card></section>
      <section id="components" className="guide-section"><SectionHeading title="组件语言"/><div className="component-grid"><Card className="guide-card"><div className="guide-card-head"><div><h3>按钮与标签</h3></div><Badge>Button / Badge</Badge></div><div className="demo-row"><Button onClick={() => setFeedback('已触发示例操作。')}><Download size={15}/> 导出报表</Button><Button variant="outline" onClick={() => setFeedback('已选择次要操作。')}>查看详情</Button><Button variant="ghost" onClick={() => setFeedback('已选择轻量操作。')}>轻量操作</Button><Button variant="outline" disabled>不可用</Button></div><div className="demo-row"><Badge>示例数据</Badge><span className="guide-feedback" role="status">{feedback}</span></div></Card><Card className="guide-card"><div className="guide-card-head"><div><h3>筛选与选择</h3></div><Badge>Segmented / Dropdown Menu</Badge></div><div className="demo-row"><SegmentedControl label="示例时间范围" value={period} onValueChange={setPeriod} options={modes}/><PeriodDropdown label="示例年份" value={year} onValueChange={setYear} options={[{value: '2025', label: '2025 年'}, {value: '2024', label: '2024 年'}]}/></div></Card></div><div className="component-grid lower-components"><Card className="guide-card"><div className="guide-card-head"><div><h3>指标卡片</h3></div><Badge>Card</Badge></div><MetricCard label="收支结余" value="¥129,500.00" icon={Wallet} tone="balance" change="+16.1%" comparison="去年同期" status="盈余"/></Card><Card className="guide-card"><div className="guide-card-head"><div><h3>信息层级</h3></div><Badge>Pattern</Badge></div><div className="anatomy"><div><span>01</span><strong>标题与主要内容</strong></div><div><span>02</span><strong>分组、对齐与留白</strong></div><div><span>03</span><strong>必要的周期、单位与状态</strong></div></div></Card></div></section>
      <section id="data" className="guide-section"><SectionHeading title="数据可视化"/><Card className="guide-card data-card"><div className="guide-card-head"><div><h3>2025 年收支趋势</h3><p>金额单位：人民币</p></div></div><div className="guide-chart" aria-label="示例图表：2025 年逐月收入与支出"><ChartContainer config={financialChartConfig} className="finplot-chart"><LineChart data={yearData(2025)} margin={{top:0,right:10,left:-22,bottom:0}}><ChartLegend verticalAlign="top" align="right" content={<ChartLegendContent className="financial-chart-legend"/>}/><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5"/><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{fill:'var(--soft-text)',fontSize:10}} dy={8}/><YAxis tickLine={false} axisLine={false} tick={{fill:'var(--soft-text)',fontSize:10}} tickFormatter={v=>v===0?'0':`${v/10000}万`} domain={[0,40000]} ticks={[0,10000,20000,30000,40000]}/><ChartTooltip isAnimationActive={!reducedMotion} content={<ChartTooltipContent className="financial-chart-tooltip" valueFormatter={money}/>}/><Line isAnimationActive={!reducedMotion} type="monotone" dataKey="income" name="收入" stroke="var(--income)" strokeWidth={2.5} dot={false}/><Line isAnimationActive={!reducedMotion} type="monotone" dataKey="expense" name="支出" stroke="var(--expense)" strokeWidth={2.2} dot={false}/></LineChart></ChartContainer></div><div className="guide-palette">{chartSeries.map((color,index) => <span key={color} style={{background:color}} title={`--chart-${index+1}`}/>) }<small>分类色按顺序使用；真实金额保留两位小数，未覆盖的周期留空，正负同时用文字或符号说明。</small></div></Card></section>
      <section id="libraries" className="guide-section"><SectionHeading title="技术与协作"/><div className="toolkit-grid"><Card className="guide-card toolkit-card"><div className="guide-card-head"><h3>统一的工具箱</h3><Layers3 size={19}/></div><div className="library-list">{libraries.map(([name,note])=><div key={name}><strong>{name}</strong><span>{note}</span></div>)}</div></Card><Card className="guide-card workflow-card"><h3>复用与动效原则</h3><ol className="workflow-steps"><li>查找项目内已有组件</li><li>需要时引入官方 registry 源码</li><li>使用设计令牌组合业务界面</li><li>组件自带动效优先，不重复叠加</li><li>减少动态效果时使用组件自身开关</li></ol><small>完整规范与代码示例：docs/design-system.md</small></Card></div></section>
      <footer className="guide-footer"><a href="#top">回到顶部 ↑</a></footer></main></div>
  </div>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><Gallery/></React.StrictMode>)
