import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export { Button } from '@/components/ui/button'
export { Card } from '@/components/ui/card'
export { Badge } from '@/components/ui/badge'
export { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

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
