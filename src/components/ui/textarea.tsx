import * as React from 'react'
import { cn } from '@/lib/utils'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'min-h-16 w-full rounded-md border border-border-strong bg-card px-2.5 py-2 text-body text-fg outline-none',
      'transition-[border-color,background-color] duration-150 ease-out',
      'hover:border-border-hover',
      'focus:border-border-focus',
      'aria-[invalid=true]:border-danger',
      'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'
