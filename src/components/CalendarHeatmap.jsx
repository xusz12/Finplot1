import React, { useMemo, useRef, useState } from 'react'
import { Card, Button, AnimatedText } from './ui'
import { calendarHeatmap } from '../lib/heatmap'
import { money } from '../finance'
import './calendar-heatmap.css'

function HeatLegend({ type, maximum }) {
  return <div className="heat-legend"><span>{type === 'income' ? '上 · 收入 +' : '下 · 支出 −'}</span><span>少</span>
    {[0, 1, 2, 3, 4].map(level => <i key={level} style={{ background: level ? `var(--heat-${type}-${level})` : 'var(--heat-empty)' }}
      title={level ? `${money((level - 1) * maximum / 400)}–${money(level * maximum / 400)}` : '无交易'}/>)}<span>多</span>
  </div>
}

export default function CalendarHeatmap({ source, year, transactions, type = 'all', selectedDate, selectedMonth, onSelect }) {
  const model = useMemo(() => calendarHeatmap(source, year, transactions), [source, year, transactions])
  const [hovered, setHovered] = useState(null)
  const [focused, setFocused] = useState(null)
  const refs = useRef(new Map())
  const selectable = model.days.filter(day => day?.available)
  const tabStop = [focused, selectedDate].find(date => selectable.some(day => day.date === date)) ?? selectable[0]?.date
  const detail = [hovered, focused, selectedDate].map(date => model.days.find(day => day?.date === date)).find(Boolean)
  const onKeyDown = (event, day) => {
    const deltas = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 }
    if (!(event.key in deltas) && !['Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = selectable.findIndex(item => item.date === day.date)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? selectable.length - 1 : Math.max(0, Math.min(selectable.length - 1, index + deltas[event.key]))
    refs.current.get(selectable[next]?.date)?.focus()
  }
  return <Card className="heatmap-card">
    <div className="heatmap-heading"><div><h3>收支热力图</h3><p><AnimatedText>{`${year} 年 · ${model.activeDays} 天有${type === 'income' ? '收入' : type === 'expense' ? '支出' : '交易'}记录`}</AnimatedText></p></div><span className="heatmap-scope">全年</span></div>
    <div className="heatmap-scroll" role="group" aria-label={`${year} 年收支热力图，上格收入，下格支出。方向键移动，回车查看当日流水。`}>
      <div className="heatmap-board" style={{ '--heat-weeks': model.weeks }}>
        <div className="heatmap-months">{model.months.map(month => <span key={month.month} style={{ gridColumn: month.week + 1 }}>{month.month}月</span>)}</div>
        <div className="heatmap-weekdays" aria-hidden="true">{['一', '', '三', '', '五', '', '日'].map((day, i) => <span key={i}>{day}</span>)}</div>
        <div className="heatmap-grid">{model.days.map((day, index) => day ? <Button key={day.date} variant="ghost"
          ref={node => { if (node) refs.current.set(day.date, node); else refs.current.delete(day.date) }}
          className={`heatmap-day ${!day.available ? 'heatmap-unavailable' : ''} ${selectedMonth && selectedMonth !== day.month ? 'heatmap-outside-month' : ''}`}
          disabled={!day.available} tabIndex={day.date === tabStop ? 0 : -1} aria-pressed={day.date === selectedDate}
          aria-label={`${day.date}，${day.available ? `${day.count} 笔交易，收入 +${money(day.income)}，支出 −${money(day.expense)}` : '账本未覆盖'}`}
          title={`${day.date} · ${day.available ? `收入 +${money(day.income)} / 支出 −${money(day.expense)}` : '账本未覆盖'}`}
          onMouseEnter={() => setHovered(day.date)} onMouseLeave={() => setHovered(null)} onFocus={() => setFocused(day.date)} onBlur={() => setFocused(null)}
          onKeyDown={event => onKeyDown(event, day)} onClick={() => onSelect(day)}>
          <i aria-hidden="true" style={{ background: day.incomeLevel ? `var(--heat-income-${day.incomeLevel})` : 'var(--heat-empty)' }}/>
          <i aria-hidden="true" style={{ background: day.expenseLevel ? `var(--heat-expense-${day.expenseLevel})` : 'var(--heat-empty)' }}/>
        </Button> : <span key={`blank-${index}`} className="heatmap-blank"/>)}</div>
      </div>
    </div>
    <div className="heatmap-footer"><div className="heatmap-detail" aria-live="polite">{detail ? <>
      <strong>{detail.date}</strong>{detail.available ? <><span>{detail.count} 笔</span>{type !== 'expense' && <span>收入 +{money(detail.income)}</span>}{type !== 'income' && <span>支出 −{money(detail.expense)}</span>}</> : <span>账本未覆盖</span>}
    </> : <span>点击日期，查看当天流水</span>}</div>
      <div className="heatmap-legends">{type !== 'expense' && <HeatLegend type="income" maximum={model.maximum.income}/>}{type !== 'income' && <HeatLegend type="expense" maximum={model.maximum.expense}/>}</div>
    </div>
    <p className="heatmap-note">颜色越深，金额越高；收支分别按全年单日最高金额分级。斜线表示账本未覆盖。</p>
  </Card>
}
