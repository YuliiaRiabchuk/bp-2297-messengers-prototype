import * as React from 'react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Shadcn-style Checkbox built on Radix `@radix-ui/react-checkbox`.
 *
 * Chrome chroma stays under OKLCH ≤ 0.03 (uses `border`/`fg` tokens, no
 * saturated hues). The check icon is `lucide-react/Check` so the app
 * keeps one icon family.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer inline-flex size-4 shrink-0 items-center justify-center rounded-[2px]',
        'border border-border-strong bg-card text-primary-fg shadow-sm outline-none',
        'transition-colors',
        'enabled:hover:border-fg/60',
        'focus-visible:ring-[3px] focus-visible:ring-fg/15 focus-visible:border-fg',
        'data-[state=checked]:border-fg data-[state=checked]:bg-fg',
        'data-[state=indeterminate]:border-fg data-[state=indeterminate]:bg-fg',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-danger-fg aria-invalid:ring-danger-fg/15',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="group/indicator flex items-center justify-center text-current"
      >
        {/* `text-current` on the icon itself so a parent menu's
            `[&_svg:not([class*=text-])]` colour rule (DropdownMenuItem) can't
            hijack the check to muted-grey on the filled box. */}
        <Check className="size-3 text-current group-data-[state=indeterminate]/indicator:hidden" strokeWidth={3} />
        <Minus className="hidden size-3 text-current group-data-[state=indeterminate]/indicator:block" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
