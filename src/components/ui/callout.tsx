import * as React from 'react'
import {
  Info,
  TriangleAlert,
  OctagonAlert,
  CircleCheck,
  type LucideIcon,
} from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Callout — semantic notice with two looks, picked automatically:
 *
 *  • **Banner** (no `eyebrow`/`title`) — flat inline alert: full soft-tone
 *    background, a small tone-coloured icon, bold tone-coloured text and an
 *    optional trailing action. The «out-of-stock → Движения» / «временный
 *    контрагент → Конвертировать» pattern from the rent screens.
 *  • **Card** (`eyebrow` and/or `title`) — status card: a tone-coloured
 *    icon-in-a-circle + uppercase eyebrow + title + neutral description (the
 *    NowPanel «Сейчас» look).
 *
 * Design-system primitive — reuse instead of hand-composing a tinted card.
 * fe-design: semantic tone tokens only (T1), one icon family — Lucide (I2/I3),
 * icons aria-hidden (I5/I6).
 *
 * @example
 * // Banner
 * <Callout variant="warning" action={<Button size="small" variant="warning">Движения</Button>}>
 *   Позиции нет на этом складе — пополните остатки.
 * </Callout>
 * // Card
 * <Callout variant="success" eyebrow="Сейчас" title="Выдать оборудование">
 *   Оба счёта закрыты.
 * </Callout>
 */
const calloutVariants = cva('', {
  variants: {
    variant: {
      information: '',
      warning: '',
      danger: '',
      success: '',
      muted: '',
    },
  },
  defaultVariants: { variant: 'information' },
})

type CalloutVariant = NonNullable<
  VariantProps<typeof calloutVariants>['variant']
>

/** Banner: soft-tone surface + a visible tone border + tone foreground (icon +
 *  text inherit the foreground colour). Blue (`accent`) is the lowest-chroma
 *  tone, so it gets a stronger border to read as crisply as the others. */
const BANNER_TONE: Record<CalloutVariant, string> = {
  information: 'border-accent/60 bg-accent-soft text-accent-fg',
  warning: 'border-warning/40 bg-warning-soft text-warning-fg',
  danger: 'border-danger/40 bg-danger-soft text-danger-fg',
  success: 'border-success/40 bg-success-soft text-success-fg',
  muted: 'border-border bg-muted text-muted-fg',
}

/** Card: lighter surface + a solid tone circle for the icon. */
const CARD_TONE: Record<CalloutVariant, { wrap: string; chip: string }> = {
  information: { wrap: 'border-accent/25 bg-accent-soft/60', chip: 'bg-accent text-on-brand' },
  warning: { wrap: 'border-warning/30 bg-warning-soft/60', chip: 'bg-warning text-on-brand' },
  danger: { wrap: 'border-danger/25 bg-danger-soft/60', chip: 'bg-danger text-on-brand' },
  success: { wrap: 'border-success/25 bg-success-soft/60', chip: 'bg-success text-on-brand' },
  muted: { wrap: 'border-border bg-muted', chip: 'bg-fg text-primary-fg' },
}

const DEFAULT_ICONS: Record<CalloutVariant, LucideIcon> = {
  information: Info,
  warning: TriangleAlert,
  danger: OctagonAlert,
  success: CircleCheck,
  muted: Info,
}

export interface CalloutProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof calloutVariants> {
  /** Uppercase eyebrow label above the title — switches to the card look. */
  eyebrow?: React.ReactNode
  /** Title line (semibold) — switches to the card look. */
  title?: React.ReactNode
  /** Override the per-variant Lucide icon. Pass `null` to hide it. */
  icon?: LucideIcon | null
  /**
   * Trailing action, right-aligned and vertically centered — e.g. a «Движения»
   * button. Pass a `Button` / `Link`.
   */
  action?: React.ReactNode
}

export const Callout = React.forwardRef<HTMLDivElement, CalloutProps>(
  (
    { className, variant, eyebrow, title, icon, action, children, ...props },
    ref,
  ) => {
    const resolved: CalloutVariant = variant ?? 'information'
    const Icon = icon === null ? null : (icon ?? DEFAULT_ICONS[resolved])
    const isCard = Boolean(eyebrow || title)

    // ── Banner (inline alert) — flat soft-tone surface, bold tone text. ──
    if (!isCard) {
      return (
        <div
          ref={ref}
          role="note"
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-body leading-snug',
            BANNER_TONE[resolved],
            className,
          )}
          {...props}
        >
          {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
          <div className="min-w-0 flex-1 font-medium">{children}</div>
          {action != null && <div className="shrink-0 pl-2">{action}</div>}
        </div>
      )
    }

    // ── Card (status card) — tone circle + eyebrow/title + neutral body. ──
    const tone = CARD_TONE[resolved]
    const hasBody = children != null && children !== false
    return (
      <div
        ref={ref}
        role="note"
        className={cn(
          'flex w-full items-start gap-3.5 rounded-lg border px-4 py-3.5 text-body',
          tone.wrap,
          className,
        )}
        {...props}
      >
        {Icon && (
          <span
            className={cn(
              'mt-0.5 grid size-9 shrink-0 place-items-center rounded-full',
              tone.chip,
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <div className="text-mono font-semibold uppercase tracking-[0.04em] text-muted-fg">
              {eyebrow}
            </div>
          )}
          {title && (
            <div
              className={cn(
                'text-title font-semibold tracking-tight text-fg',
                eyebrow && 'mt-0.5',
              )}
            >
              {title}
            </div>
          )}
          {hasBody && (
            <div className="mt-0.5 text-body leading-snug text-fg-2">
              {children}
            </div>
          )}
        </div>
        {action != null && (
          <div className="shrink-0 self-center pl-2">{action}</div>
        )}
      </div>
    )
  },
)
Callout.displayName = 'Callout'

export { calloutVariants }
