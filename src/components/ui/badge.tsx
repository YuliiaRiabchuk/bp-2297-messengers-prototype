import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-[7px] py-px text-mono font-medium tabular-nums tracking-tight',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-muted text-fg-2',
        outline: 'bg-transparent border-border text-muted-fg',
        accent: 'border-transparent bg-accent-soft text-accent-fg',
        success: 'border-transparent bg-success-soft text-success-fg',
        warning: 'border-transparent bg-warning-soft text-warning-fg',
        danger: 'border-transparent bg-danger-soft text-danger-fg',
        violet: 'border-transparent bg-violet-soft text-violet-fg',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /**
   * @deprecated BP-774 — ведущая точка убрана из ВСЕХ бейджей: цвет тона и само
   * слово уже говорят статус, кружок дублировал их третий раз и в плотных
   * таблицах читался как лишний глиф.
   *
   * Проп оставлен принимаемым, но НЕ рисует ничего: `dot` расставлен примерно в
   * двадцати местах (резервы, задачи, контрагенты, перемещения, админка,
   * дашборд), и одномоментное удаление разъехалось бы по чужим веткам. Убрать
   * проп вместе с call-site'ами — отдельной уборкой.
   */
  dot?: boolean
  /**
   * Вторая строка под основным контентом (напр. код аренды + копирование под
   * статусом «В аренде»). Когда задан — бейдж становится 2-строчным
   * (`flex-col`, `rounded-md`).
   */
  subline?: React.ReactNode
}

// `dot` вынимаем из props, чтобы он не утёк на DOM-элемент атрибутом (React
// ругается на нестандартный boolean-атрибут). Игнорируется намеренно — см.
// @deprecated выше.
export function Badge({
  className,
  variant,
  dot: _dot,
  subline,
  children,
  ...props
}: BadgeProps) {
  if (subline != null) {
    return (
      <span
        className={cn(
          badgeVariants({ variant }),
          'flex-col items-start gap-0.5 rounded-md py-1',
          className,
        )}
        {...props}
      >
        <span className="inline-flex items-center gap-1">{children}</span>
        <span className="inline-flex items-center gap-1">{subline}</span>
      </span>
    )
  }
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </span>
  )
}
