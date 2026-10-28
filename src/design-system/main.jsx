import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, Download, Layers3, MousePointer2, Sparkles, Wallet } from 'lucide-react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { Badge, Button, Card, MetricCard, NativeSelect, NativeSelectOption, SectionHeading, SegmentedControl } from '../components/ui'
import { yearData } from '../data'
import { chartSeries, financialChartConfig } from './chart'
import { ChartContainer, ChartTooltip as ShadcnChartTooltip } from '@/components/ui/chart'
import './index.css'
import './gallery.css'

const foundations = [
  { token: '--bg', label: '页面背景', note: '温和的中性底色' },
  { token: '--card', label: '卡片表面', note: '承载主要内容' },
  { token: '--text', label: '主要文字', note: '标题与关键数字' },
  { token: '--soft-text', label: '次要文字', note: '说明与辅助信息' },
  { token: '--accent', label: '强调蓝', note: '选中、图标与图表' },
  { token: '--hero-bg', label: '轻强调', note: '重点指标的底色' },
]
const libraries = [
  ['shadcn / Radix', '本地可控的基础组件与无障碍交互'],
  ['Lucide', '统一线性图标与视觉重量'],
  ['Motion', '克制、短暂且尊重减少动态效果'],
  ['shadcn Chart / Recharts', '响应式财务图表与数据提示'],
  ['shadcn Resizable', '基于 react-resizable-panels 的工作区布局'],
  ['dnd-kit', '支持指针与键盘的拖动排序'],
  ['Zustand', '界面状态与必要的本地持久化'],
]
const modes = [{ value: 'year', label: '年度' }, { value: 'month', label: '月度' }]

function Gallery() {
  const [period, setPeriod] = useState('year')
  const [year, setYear] = useState('2025')
  const [feedback, setFeedback] = useState('')
  useEffect(() => {
    const target = window.location.hash.slice(1)
    if (target) document.getElementById(target)?.scrollIntoView()
  }, [])
  return <div className="guide-shell" id="top">
    <header className="guide-top"><a className="guide-brand" href="/"><span className="guide-mark"><i/><i/><i/><i/></span><span>finplot<strong>.</strong></span></a><div className="guide-top-label">DESIGN SYSTEM <span>/</span> 设计系统</div><Button asChild variant="outline"><a href="/">返回应用 <ArrowRight size={14}/></a></Button></header>
    <div className="guide-layout"><aside className="guide-sidebar"><span>GUIDELINES</span><a href="#principles">设计原则</a><a href="#foundations">视觉基础</a><a href="#components">组件语言</a><a href="#data">数据可视化</a><a href="#libraries">技术与协作</a><div className="guide-side-note"><Sparkles size={16}/><p>让每个新功能，<br/>都像同一个作品。</p><small>FINPLOT / 01</small></div></aside>
      <main className="guide-content"><div className="guide-hero"><div><div className="guide-kicker"><span/> FINPLOT DESIGN SYSTEM <i/> VERSION 1.0</div><h1>让数字清晰，<br/><span>让生活从容。</span></h1><p>一套为个人财务设计的视觉与交互语言。用一致的基础，让新的功能自然地融入整体。</p></div><div className="guide-hero-mark" aria-hidden="true"><span/><span/><span/><span/><span/></div></div>
      <section id="principles" className="guide-section"><SectionHeading title="设计原则" meta="01 / PRINCIPLES"/><div className="principles-grid"><Card className="principle-card"><span>01</span><h3>清晰，有次序</h3><p>让关键数字先被看见，给信息一个稳定、易读的位置。</p></Card><Card className="principle-card"><span>02</span><h3>克制，有留白</h3><p>用轻边界、柔和色彩和恰当间距，给思考留出空间。</p></Card><Card className="principle-card"><span>03</span><h3>温暖，有分寸</h3><p>语气平静、具体且不评判，让财务分析贴近日常生活。</p></Card></div></section>
      <section id="foundations" className="guide-section"><SectionHeading title="视觉基础" meta="02 / FOUNDATIONS"/><div className="foundation-grid"><Card className="guide-card color-card"><div className="guide-card-head"><div><h3>颜色</h3><p>中性画布与低饱和蓝色，按用途而非装饰使用。</p></div><Badge>语义令牌</Badge></div><div className="swatches">{foundations.map(item => <div className="swatch" key={item.token}><div className="swatch-color" style={{background:`var(${item.token})`}}/><strong>{item.label}</strong><code>{item.token}</code><span>{item.note}</span></div>)}</div></Card><Card className="guide-card type-card"><div className="guide-card-head"><div><h3>字体与数字</h3><p>SF Pro 与 PingFang SC，优先使用系统字体。</p></div></div><div className="type-sample"><span>Aa <b>一二三</b></span><strong>¥128,640.00</strong><small>SF PRO / PINGFANG SC · 等宽数字</small></div></Card></div><Card className="guide-card spacing-card"><div className="guide-card-head"><div><h3>间距与圆角</h3><p>以 4px 为基础节奏，优先选用共享令牌。</p></div></div><div className="spacing-row">{['--space-1','--space-2','--space-3','--space-4','--space-6','--space-8'].map(token => <div key={token}><span style={{width:`var(${token})`}}/><code>{token}</code></div>)}<div className="radius-sample"><span/><code>--radius</code></div></div></Card></section>
      <section id="components" className="guide-section"><SectionHeading title="组件语言" meta="03 / COMPONENTS"/><div className="component-grid"><Card className="guide-card"><div className="guide-card-head"><div><h3>按钮与标签</h3><p>主操作明确，次要操作保持轻盈。</p></div><Badge>Button / Badge</Badge></div><div className="demo-row"><Button onClick={() => setFeedback('已触发示例操作。')}><Download size={15}/> 导出报表</Button><Button variant="outline" onClick={() => setFeedback('已选择次要操作。')}>查看详情</Button><Button variant="ghost" onClick={() => setFeedback('已选择轻量操作。')}>轻量操作</Button><Button variant="outline" disabled>不可用</Button></div><div className="demo-row"><Badge>示例数据</Badge><Badge>v1.0</Badge><span className="guide-feedback" role="status">{feedback || '点击按钮可体验反馈'}</span></div></Card><Card className="guide-card"><div className="guide-card-head"><div><h3>筛选与选择</h3><p>状态始终可见，支持键盘与辅助技术。</p></div><Badge>Segmented / Select</Badge></div><div className="demo-row"><SegmentedControl label="示例时间范围" value={period} onValueChange={setPeriod} options={modes}/><NativeSelect label="示例年份" value={year} onChange={event => setYear(event.target.value)}><NativeSelectOption value="2025">2025 年</NativeSelectOption><NativeSelectOption value="2024">2024 年</NativeSelectOption></NativeSelect></div><div className="guide-selection"><Check size={15}/> 当前选择：{year} 年 · {period === 'year' ? '年度' : '月度'}</div></Card></div><div className="component-grid lower-components"><Card className="guide-card"><div className="guide-card-head"><div><h3>指标卡片</h3><p>标签、金额、变化与状态保持固定层级。</p></div><Badge>Card</Badge></div><MetricCard label="收支结余" value="¥129,500.00" icon={Wallet} tone="balance" change="+16.1%" comparison="去年同期" status="盈余 · 收支健康" action={<Badge>本期</Badge>}/></Card><Card className="guide-card"><div className="guide-card-head"><div><h3>信息层级</h3><p>每张卡只承担一个清楚的任务。</p></div><Badge>Pattern</Badge></div><div className="anatomy"><div><span>01</span><strong>标题</strong><small>说明内容是什么</small></div><div><span>02</span><strong>主要内容</strong><small>数字、图表或操作</small></div><div><span>03</span><strong>补充说明</strong><small>单位、周期与状态</small></div></div></Card></div></section>
      <section id="data" className="guide-section"><SectionHeading title="数据可视化" meta="04 / DATA"/><Card className="guide-card data-card"><div className="guide-card-head"><div><h3>让数据自己说话</h3><p>蓝色用于收入与重点，浅灰蓝用于支出；始终提供文字、单位和图例。</p></div><div className="guide-legend"><span><i style={{background:'var(--income)'}}/>收入</span><span><i style={{background:'var(--expense)'}}/>支出</span></div></div><div className="guide-chart" aria-label="示例图表：2025 年逐月收入与支出"><ChartContainer config={financialChartConfig} className="finplot-chart"><LineChart data={yearData(2025)} margin={{top:10,right:10,left:-22,bottom:0}}><CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5"/><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{fill:'var(--soft-text)',fontSize:10}} dy={8}/><YAxis tickLine={false} axisLine={false} tick={{fill:'var(--soft-text)',fontSize:10}} tickFormatter={v=>v===0?'0':`${v/10000}万`} domain={[0,40000]} ticks={[0,10000,20000,30000,40000]}/><ShadcnChartTooltip formatter={value=>`¥${Number(value).toLocaleString('zh-CN')}`}/><Line type="monotone" dataKey="income" name="收入" stroke="var(--income)" strokeWidth={2.5} dot={false}/><Line type="monotone" dataKey="expense" name="支出" stroke="var(--expense)" strokeWidth={2.2} dot={false}/></LineChart></ChartContainer></div><div className="guide-palette">{chartSeries.map((color,index) => <span key={color} style={{background:color}} title={`--chart-${index+1}`}/>) }<small>分类色按顺序使用，金额正负同时用文字或符号说明。</small></div></Card></section>
      <section id="libraries" className="guide-section"><SectionHeading title="技术与协作" meta="05 / TOOLKIT"/><div className="toolkit-grid"><Card className="guide-card toolkit-card"><div className="guide-card-head"><div><h3>统一的工具箱</h3><p>复用已有依赖，优先扩展项目内的组件。</p></div><Layers3 size={19}/></div><div className="library-list">{libraries.map(([name,note])=><div key={name}><strong>{name}</strong><span>{note}</span></div>)}</div></Card><Card className="guide-card workflow-card"><span className="workflow-icon"><MousePointer2 size={19}/></span><h3>开始一个新功能</h3><p>先使用令牌与现有组件，再为特定场景组合页面。交互、空状态和可访问性同样属于设计的一部分。</p><div><ArrowDownLeft size={14}/> 复用基础 <ArrowUpRight size={14}/> 保持一致</div><small>完整规范与代码示例位于项目的 docs/design-system.md。</small></Card></div></section>
      <footer className="guide-footer"><span>FINPLOT / BUILT WITH INTENTION</span><a href="#top">回到顶部 ↑</a></footer></main></div>
  </div>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><Gallery/></React.StrictMode>)
