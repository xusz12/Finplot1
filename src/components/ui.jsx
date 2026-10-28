import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { ChevronDown } from 'lucide-react'

export function cn(...inputs) { return twMerge(clsx(inputs)) }

const buttonVariants = cva('ui-button', {
  variants: {
    variant: { default: 'button-default', outline: 'button-outline', ghost: 'button-ghost', subtle: 'button-subtle' },
    size: { default: '', sm: 'button-sm', icon: 'button-icon' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})
export const Button = React.forwardRef(({ className, variant, size, asChild = false, type, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} type={asChild ? type : (type || 'button')} {...props} />
})
Button.displayName = 'Button'
export const Card = React.forwardRef(({ className, ...props }, ref) => <div ref={ref} className={cn('ui-card', className)} {...props} />)
Card.displayName = 'Card'
export const Badge = ({ className, ...props }) => <span className={cn('ui-badge', className)} {...props} />

/** Controlled, single-choice buttons. Labels must describe the option group. */
export function SegmentedControl({ label, value, onValueChange, options, compact = false, className }) {
  return <div role="group" aria-label={label} className={cn(compact ? 'small-tabs' : 'segmented', className)}>
    {options.map(option => <button key={option.value} type="button" disabled={option.disabled} aria-pressed={value === option.value} className={value === option.value ? 'active' : ''} onClick={() => onValueChange(option.value)}>{option.label}</button>)}
  </div>
}

/** Native select retains platform keyboard and screen-reader behaviour. */
export const NativeSelect = React.forwardRef(({ label, className, children, ...props }, ref) => <label className={cn('select-wrap', className)}>
  <span className="sr-only">{label}</span>
  <select ref={ref} {...props}>{children}</select>
  <ChevronDown size={14} aria-hidden="true"/>
</label>)
NativeSelect.displayName = 'NativeSelect'

export function SectionHeading({ title, meta, action, className }) {
  return <div className={cn('section-heading', className)}><div><span className="section-square" aria-hidden="true"/><h2>{title}</h2>{meta && <span className="section-meta">{meta}</span>}</div>{action}</div>
}

/** Financial summary card; the caller supplies formatted values and meaning. */
export function MetricCard({ label, value, icon: Icon, tone = 'income', change, comparison, favorable = true, status, action, className }) {
  return <Card className={cn('metric-card', `metric-${tone}`, className)}>
    <div className="metric-top"><div className="metric-name"><span className="metric-icon">{Icon && <Icon size={15} aria-hidden="true"/>}</span>{label}</div>{action}</div>
    <div className="metric-value">{value}</div>
    {(change || comparison) && <div className="metric-bottom">{change && <span className={`metric-change ${favorable ? 'positive' : 'negative'}`}>{change}</span>}{comparison && <span>较{comparison}</span>}</div>}
    {status && <div className="metric-note">{status}</div>}
  </Card>
}
