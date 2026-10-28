// shadcn/ui new-york registry (MIT): https://ui.shadcn.com/r/styles/new-york/input.json
// JavaScript conversion and Finplot theme adaptations are maintained locally.
import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input type={type} className={cn('ui-input flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm', className)} ref={ref} {...props}/>
))
Input.displayName = 'Input'
export { Input }
