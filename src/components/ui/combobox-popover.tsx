import * as React from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { useAnchorScrollPin } from '@/hooks/useAnchorScrollPin'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

/**
 * ComboboxPopover — the shared scaffold for click-to-open search popovers
 * (counterparty picker, responsible-user picker, …). It owns the bits every
 * such combobox was re-deriving by hand on top of Radix `Popover`:
 *
 *  - trigger via `asChild` (the caller renders the button),
 *  - content width locked to the trigger (`--radix-popover-trigger-width`),
 *  - height capped to the viewport gap (`--radix-popover-content-available-
 *    height`) as a flex column so a long list scrolls while header/footer
 *    stay pinned — the clipping fix that previously had to be re-applied
 *    per combobox,
 *  - focus redirected to the search field on open (`onOpenAutoFocus`).
 *
 * It does NOT dictate the inner layout: callers compose their own search
 * row / list / footer as `children`. This keeps it a deep scaffold, not a
 * shallow flag-driven mega-component — comboboxes whose lifecycle differs
 * (typing-driven `FloatingPanel`, hand-rolled tree pickers) deliberately
 * stay on their own primitives.
 */
interface ComboboxPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The trigger element — rendered via Radix `asChild`. */
  trigger: React.ReactNode
  children: React.ReactNode
  /** Focused on open (defaults to Radix's first-focusable behaviour). */
  initialFocusRef?: React.RefObject<HTMLElement | null>
  align?: React.ComponentProps<typeof PopoverContent>['align']
  sideOffset?: number
  /** Lock content width to the trigger width. Default `true`. */
  matchTriggerWidth?: boolean
  /**
   * Floor for the popover width — applied via `min-width` so the dropdown
   * stays readable when the trigger sits in a tight column. Defaults to
   * `20rem` (320 px), which fits most «name — phone — ИНН» combobox rows
   * without truncation. Pass `0` to opt out, or any CSS length to override.
   */
  minWidth?: string | number
  /** Extra classes for the content surface. */
  contentClassName?: string
  /**
   * Radix `modal` на Popover.Root. Включай, когда пикер живёт ВНУТРИ модального
   * Dialog'а: его scroll-lock (react-remove-scroll) глушит колесо над
   * порталированным попапом — список «не скроллится» (BP-472, пикер
   * интересов в «Добавить интерес»). Модальный popover ставит собственный
   * scroll-lock и колесо внутри списка снова работает.
   */
  modal?: boolean
  /**
   * Отступ контента от краёв вьюпорта при collision-сдвиге (radix
   * `collisionPadding`). Radix-дефолт 0 прижимает широкий дропдаун вплотную
   * к краю экрана (пикер интересов в дровере звонка, user 01.07) — передай
   * 12–16, чтобы оставался воздух.
   */
  collisionPadding?: number
  /**
   * Закрывать ли попап по клику мимо. Дефолт `true` — для списка это верно:
   * промахнулся мимо — список закрылся, терять нечего.
   *
   * `false`, когда внутри попапа живёт ФОРМА, а не список (BP-1245: случайный
   * клик мимо сносил панель «новый контрагент» вместе со всем набранным).
   * Esc не трогаем — это осознанное нажатие и обязательный выход (F8).
   */
  dismissOnInteractOutside?: boolean
  'data-testid'?: string
}

export function ComboboxPopover({
  open,
  onOpenChange,
  trigger,
  children,
  initialFocusRef,
  align = 'start',
  sideOffset = 4,
  matchTriggerWidth = true,
  minWidth = '20rem',
  contentClassName,
  collisionPadding,
  dismissOnInteractOutside = true,
  modal = false,
  'data-testid': dataTestid,
}: ComboboxPopoverProps) {
  // While open, hold the trigger still if content above it resizes (an AI
  // panel streaming in, a section expanding) — the Radix popper follows its
  // anchor, so a shoved trigger drags the open dropdown with it (BP-466).
  // Lives here so every ComboboxPopover-based picker (interests, counterparty,
  // responsible, status, …) is covered on every surface.
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  useAnchorScrollPin(triggerRef, open)

  const handleOpenAutoFocus = initialFocusRef
    ? (e: Parameters<
        NonNullable<
          React.ComponentProps<typeof PopoverPrimitive.Content>['onOpenAutoFocus']
        >
      >[0]) => {
        // Radix focuses the content wrapper by default; redirect to the
        // designated field (usually the search input) so typing is instant.
        e.preventDefault()
        initialFocusRef.current?.focus()
      }
    : undefined

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={modal}>
      <PopoverTrigger asChild ref={triggerRef}>
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        onOpenAutoFocus={handleOpenAutoFocus}
        onInteractOutside={
          dismissOnInteractOutside ? undefined : (e) => e.preventDefault()
        }
        data-testid={dataTestid}
        // `min-width` stays as inline style so a caller-passed `minWidth=0`
        // actually opts out — overriding it via className would require a
        // second arbitrary-value rule and tailwind-merge specificity gymnastics.
        style={minWidth ? { minWidth } : undefined}
        className={cn(
          'flex max-h-[var(--radix-popover-content-available-height)] flex-col overflow-hidden p-0',
          // Arbitrary-value `w-[var(...)]` (not shorthand `w-(--...)`) so
          // tailwind-merge recognises it as the same `width` utility and
          // overrides the `w-72` baked into `<PopoverContent>` chrome.
          matchTriggerWidth && 'w-[var(--radix-popover-trigger-width)]',
          contentClassName,
        )}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
