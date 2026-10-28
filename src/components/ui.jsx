import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export { Button } from '@/components/ui/button'
export { Card } from '@/components/ui/card'
export { Badge } from '@/components/ui/badge'

/** Labeled single-choice menu built from shadcn/ui DropdownMenu. */
export function PeriodDropdown({ label, value, onValueChange, options, disabled = false, className }) {
  const selected = options.find(option => String(option.value) === String(value))
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="outline" className={cn('period-dropdown', className)} disabled={disabled} aria-label={`${label}，当前 ${selected?.label ?? '未选择'}`}>
      <span>{selected?.label ?? label}</span><ChevronDown size={14} aria-hidden="true"/>
    </Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={7} className="period-menu" onOpenAutoFocus={event => {
      const selectedItem = event.currentTarget.querySelector('[role="menuitemradio"][data-state="checked"]')
      if (selectedItem) {
        event.preventDefault()
        selectedItem.focus()
        requestAnimationFrame(() => { if (selectedItem.isConnected) selectedItem.scrollIntoView({ block: 'nearest' }) })
      }
    }}>
      <DropdownMenuLabel className="period-menu-label">{label}</DropdownMenuLabel>
      <DropdownMenuSeparator className="period-menu-separator"/>
      <DropdownMenuRadioGroup value={String(value)} onValueChange={onValueChange}>
        {options.map(option => <DropdownMenuRadioItem key={option.value} value={String(option.value)} className="period-menu-item">{option.label}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
}

/** Stable slots keep the mode switch in place when the month is not applicable. */
export function PeriodSelector({ year, month, mode, years, onYearChange, onMonthChange, onModeChange, allowMode = true }) {
  const annual = allowMode && mode === 'year'
  return <div className={cn('period-selector', !allowMode && 'period-selector-month-only')}>
    {allowMode && <SegmentedControl className="period-mode" label="时间范围" value={mode} onValueChange={onModeChange}
      options={[{ value: 'year', label: '年度' }, { value: 'month', label: '月度' }]}/>}
    <PeriodDropdown className="period-year" label="选择年份" value={year} onValueChange={onYearChange}
      options={years.map(value => ({ value, label: `${value} 年` }))}/>
    <PeriodDropdown className="period-month" label={annual ? '月份范围' : '选择月份'} disabled={annual}
      value={annual ? 'all' : month} onValueChange={onMonthChange}
      options={annual ? [{ value: 'all', label: '全年' }] : Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1} 月` }))}/>
  </div>
}

/** A required single choice composed from shadcn/ui's ToggleGroup. */
export function SegmentedControl({ label, value, onValueChange, options, compact = false, className }) {
  return <ToggleGroup type="single" aria-label={label} value={value} onValueChange={next => { if (next) onValueChange(next) }} className={cn(compact ? 'small-tabs' : 'segmented', className)}>
    {options.map(option => <ToggleGroupItem key={option.value} value={option.value} disabled={option.disabled} className={value === option.value ? 'active' : ''}>{option.label}</ToggleGroupItem>)}
  </ToggleGroup>
}

export function SectionHeading({ title, meta, action, className }) {
  return <div className={cn('section-heading', className)}><div><span className="section-square" aria-hidden="true"/><h2>{title}</h2>{meta && <span className="section-meta">{meta}</span>}</div>{action}</div>
}

/** Financial summary composed from shadcn/ui's Card. */
export function MetricCard({ label, value, icon: Icon, tone = 'income', change, comparison, favorable = true, status, action, className }) {
  return <Card className={cn('metric-card', `metric-${tone}`, className)}>
    <div className="metric-top"><div className="metric-name"><span className="metric-icon">{Icon && <Icon size={15} aria-hidden="true"/>}</span>{label}</div>{action}</div>
    <div className="metric-value">{value}</div>
    {(change || comparison) && <div className="metric-bottom">{change && <span className={`metric-change ${favorable ? 'positive' : 'negative'}`}>{change}</span>}{comparison && <span>较{comparison}</span>}</div>}
    {status && <div className="metric-note">{status}</div>}
  </Card>
}
