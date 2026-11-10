import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'h-8 w-full rounded-md border border-border-strong bg-card px-2.5 text-body text-fg outline-none',
      'transition-[color,border-color,background-color] duration-150 ease-out',
      'hover:border-border-hover',
      'focus:border-border-focus',
      'aria-[invalid=true]:border-danger',
      'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'
