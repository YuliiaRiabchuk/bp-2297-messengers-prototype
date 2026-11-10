import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

/**
 * Единый сегмент-контрол — выбор из 2–4 взаимоисключающих режимов
 * (Самовывоз/Доставка, Туда/Туда+обратно, − + =, % ₴, Номенклатура/Комплект).
 * Контейнер-трек, **thumb-индикатор** скользит под активный сегмент
 * (fly-индикатор, Linear/macOS), неактивные muted, активный — выделен.
 * Thumb позиционируется замером реального сегмента (offsetLeft/offsetWidth) —
 * сегменты автоширины, не равные.
 *
 * Два вида (`variant`):
 *  - `thumb` (по умолчанию) — светлый card-thumb на `bg-muted` треке,
 *    активный текст ink. Лёгкий inline-выбор (способ доставки, оператор цены).
 *  - `solid` — чёрный (`bg-fg`) thumb на `bg-card` треке с бордером, активный
 *    текст инверсный (`text-bg`). Сохраняет «чёрную пилюлю» каталога
 *    (Номенклатурная позиция / Виртуальный комплект), добавляя переезд.
 *
 * Анимация — CSS-transition на `transform`/`width` (180ms ease-out), без
 * motion-зависимости; под `prefers-reduced-motion` гасится через
 * `motion-reduce:transition-none`.
 *
 * a11y: `role="radiogroup"` + `role="radio"` с `aria-checked`; клавиатура
 * стрелками — браузерная радио-семантика плюс явные ← → хендлеры.
 */
export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  /** Tooltip / SR-имя — когда label это символ («−», «₴»). */
  title?: string
  /** Проброс `data-testid` на конкретный сегмент. */
  testId?: string
}

type Variant = 'thumb' | 'solid'

const SIZE: Record<'sm' | 'md', { h: string; px: string; text: string }> = {
  sm: { h: 'h-6', px: 'px-2', text: 'text-label' },
  md: { h: 'h-7', px: 'px-2.5', text: 'text-body' },
}

const VARIANT: Record<
  Variant,
  { track: string; thumb: string; activeText: string; ringOffset: string }
> = {
  thumb: {
    track: 'bg-muted',
    thumb: 'bg-card shadow-sm ring-1 ring-black/[0.04]',
    activeText: 'text-fg',
    ringOffset: 'focus-visible:ring-offset-muted',
  },
  solid: {
    track: 'bg-card border border-border',
    thumb: 'bg-fg shadow-sm',
    activeText: 'text-bg',
    ringOffset: 'focus-visible:ring-offset-card',
  },
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  variant = 'thumb',
  fullWidth = false,
  ariaLabel,
  className,
}: {
  value: T
  options: SegmentOption<T>[]
  onChange: (next: T) => void
  size?: 'sm' | 'md'
  variant?: Variant
  /** Растянуть на всю ширину контейнера; сегменты делятся поровну. */
  fullWidth?: boolean
  ariaLabel?: string
  className?: string
}) {
  const btnRefs = useRef<Map<T, HTMLButtonElement | null>>(new Map())
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(
    null,
  )
  const sz = SIZE[size]
  const v = VARIANT[variant]

  // Замер активного сегмента → позиция/ширина thumb-а. useLayoutEffect, чтобы
  // не было кадра с thumb-ом в (0,0). ResizeObserver ловит ресайз контейнера
  // (i18n-длина лейблов, флекс-сжатие соседей, ресайз панели).
  useLayoutEffect(() => {
    const el = btnRefs.current.get(value)
    // value вне набора (напр. «нет выбора») — прячем thumb, а не оставляем под
    // прежним сегментом: иначе индикатор «залипает» под старым выбором.
    if (!el) {
      setThumb(null)
      return
    }
    const measure = () =>
      setThumb({ left: el.offsetLeft, width: el.offsetWidth })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const parent = el.parentElement
    if (parent) ro.observe(parent)
    return () => ro.disconnect()
    // Re-measure on option-set change (i18n labels / count), not on the
    // inline-array identity that consumers re-allocate each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.map((o) => o.value).join('|')])

  const idx = options.findIndex((o) => o.value === value)
  const move = (dir: -1 | 1) => {
    const next = options[(idx + dir + options.length) % options.length]
    if (next) onChange(next.value)
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'relative items-center rounded-md p-0.5',
        fullWidth ? 'flex w-full' : 'inline-flex w-fit',
        v.track,
        className,
      )}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault()
          move(1)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault()
          move(-1)
        }
      }}
    >
      {thumb && (
        <span
          aria-hidden
          className={cn(
            'absolute bottom-0.5 top-0.5 left-0 rounded-sm',
            v.thumb,
            'transition-[transform,width] duration-[180ms] ease-out motion-reduce:transition-none',
          )}
          style={{
            transform: `translateX(${thumb.left}px)`,
            width: thumb.width,
          }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              if (el) btnRefs.current.set(o.value, el)
              else btnRefs.current.delete(o.value)
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={o.title}
            data-testid={o.testId}
            onClick={() => onChange(o.value)}
            className={cn(
              // `whitespace-nowrap` — метка сегмента («+1 ч») не должна
              // переноситься по слову «+1» / «ч» в узком/скроллируемом контейнере
              // (юзер: «числа не ломались»).
              'relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm font-medium leading-none',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1',
              v.ringOffset,
              fullWidth && 'min-w-0 flex-1',
              sz.h,
              sz.px,
              sz.text,
              active ? v.activeText : 'text-muted-fg hover:text-fg',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
