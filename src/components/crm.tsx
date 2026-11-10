import type { ReactNode } from 'react'
import { ArrowRight, Building2, Clock, PhoneCall, PhoneIncoming, PhoneMissed } from 'lucide-react'
import { cn } from '@/lib/utils'
import { initials } from '@/mock/select'
import type { CallEvent, Counterparty } from '@/mock/types'

/**
 * Примітиви CRM, перенесені з `budprokat-crm/apps/crm/src` один до одного за
 * класами: `components/layout/{PageTabs,SectionCard}.tsx`,
 * `components/ui/grouped-table.tsx`, `features/calls/registry/cells.tsx`.
 * Варіанти збираються з них, щоб різниця між кадрами була у флоу, а не в
 * пікселях.
 */

/* ─── Avatar ───────────────────────────────────────────────────────── */

const AVATAR_TONE = {
  muted: 'bg-muted text-fg-2',
  accent: 'bg-accent-soft text-accent-fg',
  teal: 'bg-teal-soft text-teal-fg',
  violet: 'bg-violet-soft text-violet-fg',
  warning: 'bg-warning-soft text-warning-fg',
  success: 'bg-success-soft text-success-fg',
} as const

export type AvatarTone = keyof typeof AVATAR_TONE

export function Avatar({
  name,
  tone = 'muted',
  size = 6,
  square,
  children,
  className,
}: {
  name?: string
  tone?: AvatarTone
  size?: 5 | 6 | 7 | 8
  square?: boolean
  children?: ReactNode
  className?: string
}) {
  const dim = { 5: 'size-5 text-mono', 6: 'size-6 text-mono', 7: 'size-7 text-mono', 8: 'size-8 text-label' }[size]
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid shrink-0 place-items-center font-semibold [&_svg]:size-3',
        square ? 'rounded-md' : 'rounded-full',
        dim,
        AVATAR_TONE[tone],
        className,
      )}
    >
      {children ?? (name ? initials(name) : '?')}
    </span>
  )
}

export function CounterpartyAvatar({ cp, size = 6 }: { cp: Counterparty | null; size?: 5 | 6 | 7 | 8 }) {
  if (!cp) return <Avatar tone="warning" size={size} />
  if (cp.kind === 'UL')
    return (
      <Avatar tone="teal" size={size} square>
        <Building2 />
      </Avatar>
    )
  if (cp.kind === 'TEMP')
    return (
      <Avatar tone="warning" size={size}>
        <Clock />
      </Avatar>
    )
  return <Avatar name={cp.name} tone="accent" size={size} />
}

/* ─── SectionCard (`components/layout/SectionCard.tsx`) ───────────── */

export function SectionCard({
  icon,
  title,
  count,
  headExtra,
  tabs,
  cap,
  action,
  onAction,
  className,
  bodyClassName,
  children,
  ...rest
}: {
  icon?: ReactNode
  title?: ReactNode
  count?: number
  headExtra?: ReactNode
  tabs?: ReactNode
  cap?: string
  action?: ReactNode
  onAction?: () => void
  className?: string
  bodyClassName?: string
  children?: ReactNode
} & Omit<React.HTMLAttributes<HTMLElement>, 'title'>) {
  return (
    <section className={cn('flex flex-col overflow-hidden rounded-xl border border-border bg-card', className)} {...rest}>
      {title != null && (
        <header className="flex shrink-0 items-center gap-2 border-b border-border/40 px-3.5 py-2.5">
          {icon && <span className="inline-flex text-muted-fg [&_svg]:size-3.5">{icon}</span>}
          <span className="text-mono font-semibold uppercase tracking-wider text-muted-fg">{title}</span>
          {count != null && (
            <span className="inline-flex h-4 min-w-[17px] items-center justify-center rounded-full bg-muted px-1.5 text-mono font-semibold tabular-nums text-muted-fg">
              {count}
            </span>
          )}
          {headExtra && <div className="ml-auto flex items-center gap-1.5">{headExtra}</div>}
        </header>
      )}
      {tabs && <div className="shrink-0">{tabs}</div>}
      <div className={cn('min-h-0', cap && `overflow-y-auto ${cap}`, bodyClassName)}>{children}</div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="flex w-full shrink-0 items-center gap-1 border-t border-border/40 px-3.5 py-2 text-left text-label font-medium text-accent-fg hover:bg-muted/50"
        >
          {action} <ArrowRight className="size-3" />
        </button>
      )}
    </section>
  )
}

export function WidgetEmpty({ children }: { children: ReactNode }) {
  return <div className="px-3.5 py-[18px] text-center text-body text-subtle">{children}</div>
}

/* ─── Вкладки сторінки (`components/layout/PageTabs.tsx`, folder md) ── */

export function PageTabStrip({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className={cn('relative shrink-0 bg-muted', trailing != null && 'flex items-end')}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border" />
      <div role="tablist" className={cn('relative flex items-end gap-1 px-3 pt-1.5', trailing != null && 'min-w-0 flex-1')}>
        {children}
      </div>
      {trailing != null && <div className="relative flex shrink-0 items-center self-stretch pr-2">{trailing}</div>}
    </div>
  )
}

export function PageTab({
  active,
  onClick,
  testId,
  children,
}: {
  active: boolean
  onClick: () => void
  testId?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={testId}
      onClick={onClick}
      className={cn(
        'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-lg border border-b-0 px-3.5 py-1.5 text-body font-medium outline-none transition-colors duration-150 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1 focus-visible:ring-offset-muted',
        active ? 'z-10 border-border bg-card text-fg' : 'border-transparent text-muted-fg hover:bg-card/50 hover:text-fg',
      )}
    >
      {children}
    </button>
  )
}

const COUNT_TONE = {
  neutral: 'bg-muted text-muted-fg',
  warning: 'bg-warning-soft text-warning-fg ring-1 ring-warning/30',
  accent: 'bg-accent-soft text-accent-fg ring-1 ring-accent/30',
  danger: 'bg-danger-soft text-danger-fg ring-1 ring-danger/30',
}

export function PageTabCount({ tone = 'neutral', children }: { tone?: keyof typeof COUNT_TONE; children: ReactNode }) {
  return (
    <span className={cn('inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-px text-mono font-medium tabular-nums', COUNT_TONE[tone])}>
      {children}
    </span>
  )
}

/* ─── Таблиця з групами (`components/ui/grouped-table.tsx`) ────────── */

export const HEAD_CELL =
  'sticky top-0 z-[1] border-y border-border bg-card px-2.5 py-1.5 text-left text-mono font-semibold uppercase tracking-wide text-muted-fg whitespace-nowrap'
export const FULL_BLEED = '[&_tr>*:first-child:not([colspan])]:pl-5 [&_tr>*:last-child:not([colspan])]:pr-4'
export const CELL = 'border-b border-border px-2.5 py-2 align-middle text-body text-fg-2'

export function GroupHeaderRow({ label, count, colSpan }: { label: string; count?: number; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="sticky top-[29px] z-[1] border-b border-border bg-muted py-1.5 pl-5 pr-4">
        <span className="flex items-center gap-1.5">
          <span className="text-mono font-semibold uppercase tracking-wide text-muted-fg">{label}</span>
          {count != null && <span className="text-mono tabular-nums text-subtle">{count}</span>}
        </span>
      </td>
    </tr>
  )
}

/* ─── Клітинки журналу (`features/calls/registry/cells.tsx`) ───────── */

const DIR_ICON = { in: PhoneIncoming, out: PhoneCall, missed: PhoneMissed }
const DIR_CLASS = { in: 'text-success-fg', out: 'text-accent-fg', missed: 'text-danger-fg' }
export const DIR_LABEL = { in: 'Вхідний', out: 'Вихідний', missed: 'Пропущений' }

export function CallDirectionIcon({ dir, className }: { dir: CallEvent['dir']; className?: string }) {
  const Icon = DIR_ICON[dir]
  return <Icon className={cn('size-4 shrink-0', DIR_CLASS[dir], className)} aria-label={DIR_LABEL[dir]} />
}

export function ContactCell({
  cp,
  phone,
  emphasizePhone,
  onOpen,
  extra,
}: {
  cp: Counterparty | null
  phone?: string | null
  emphasizePhone?: boolean
  onOpen?: () => void
  extra?: ReactNode
}) {
  if (!cp)
    return (
      <div className="flex items-center gap-2">
        <Avatar tone="warning" size={6} />
        <span className={cn('min-w-0 flex-1 truncate font-medium tabular-nums text-fg', emphasizePhone && 'font-semibold')}>{phone ?? '—'}</span>
        {extra}
      </div>
    )
  return (
    <div className="flex min-w-0 items-center gap-2">
      <CounterpartyAvatar cp={cp} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpen?.()
          }}
          className="block max-w-full truncate text-left font-medium text-fg hover:underline"
          data-open-cp={cp.id}
        >
          {cp.name}
        </button>
        <span className={cn('block truncate tabular-nums', emphasizePhone ? 'text-body font-semibold text-fg-2' : 'text-label text-muted-fg')}>
          {cp.phone}
        </span>
      </div>
      {extra}
    </div>
  )
}

export function CallDateTime({ date, time }: { date?: string; time: string }) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      {date && <span className="text-muted-fg">{date} </span>}
      <span className="text-fg-2">{time}</span>
    </span>
  )
}
