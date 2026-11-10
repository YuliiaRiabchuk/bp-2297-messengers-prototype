import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md text-body font-medium whitespace-nowrap transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1 disabled:opacity-55 disabled:pointer-events-none [&_svg]:size-3.5',
  {
    variants: {
      variant: {
        default:
          'bg-fg text-primary-fg border border-fg hover:bg-fg-2',
        secondary:
          'bg-card text-fg border border-border hover:bg-muted',
        ghost:
          'bg-transparent text-fg-2 border border-transparent hover:bg-muted',
        danger:
          'bg-danger text-white border border-danger hover:brightness-95',
        success:
          'bg-success text-white border border-success hover:brightness-95',
        accent:
          'bg-accent text-white border border-accent hover:brightness-95',
        notice:
          'bg-notice text-white border border-notice hover:brightness-95',
        warning:
          'bg-warning text-white border border-warning hover:brightness-95',
      },
      size: {
        // Canonical names. Use these in new code.
        small: 'h-control px-2.5 text-xs rounded-sm',
        medium: 'h-[30px] px-3',
        large: 'h-9 px-4 text-body',
        icon: 'h-[30px] w-[30px] p-0',
        // Legacy aliases — kept so existing callsites compile. Prefer
        // small / medium / large in new code.
        sm: 'h-control px-2.5 text-xs rounded-sm',
        default: 'h-[30px] px-3',
        lg: 'h-9 px-4 text-body',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'medium',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * Действие выполняется: спиннер перед содержимым, кнопка выключена и
   * `aria-busy` для скринридера.
   *
   * Это ровно тот вид, который в приложении и так набирали руками — `disabled` +
   * `{pending && <Loader2 className="animate-spin" />}` перед подписью
   * (`NextActionButton`, `IssueGate`, продление, гард-поповеры). Двадцать пять
   * рукописных копий — двадцать пять мест, где спиннер может оказаться другого
   * размера или без `aria-busy`; поэтому вид переехал в саму кнопку.
   *
   * Кнопка с СОБСТВЕННОЙ ведущей иконкой прячет её на время загрузки сама
   * (`{!loading && <PackageCheck />}`) — иначе спиннер встал бы рядом с ней, а
   * не вместо неё.
   *
   * С `asChild` не работает: у `Slot` ровно один ребёнок, и второй сломал бы
   * подстановку. Ссылке-кнопке спиннер и не нужен — она никуда не «грузится».
   */
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      type,
      children,
      ...props
    },
    ref,
  ) => {
    if (asChild) {
      return (
        <Slot.Root
          ref={ref}
          className={cn(buttonVariants({ variant, size }), className)}
          {...props}
        >
          {children}
        </Slot.Root>
      )
    }
    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {/* `motion-reduce:hidden` — как в «К выдаче»: тем, кто выключил
            анимации, крутящийся глиф не показываем, состояние несёт
            `aria-busy` и выключенная кнопка. */}
        {loading && (
          <Loader2
            className="size-3 animate-spin motion-reduce:hidden"
            aria-hidden
          />
        )}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
