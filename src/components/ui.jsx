import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) { return twMerge(clsx(inputs)) }

const buttonVariants = cva('ui-button', {
  variants: { variant: { default: 'button-default', outline: 'button-outline', ghost: 'button-ghost', subtle: 'button-subtle' }, size: { default: '', sm: 'button-sm', icon: 'button-icon' } },
  defaultVariants: { variant: 'default', size: 'default' },
})
export const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
Button.displayName = 'Button'
export const Card = React.forwardRef(({ className, ...props }, ref) => <div ref={ref} className={cn('ui-card', className)} {...props} />)
Card.displayName = 'Card'
export const Badge = ({ className, ...props }) => <span className={cn('ui-badge', className)} {...props} />
