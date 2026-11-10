import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Плавное появление/исчезновение блока по ВЫСОТЕ — вместо условного рендера,
 * который вставляет и выдёргивает элемент рывком (user 26.07: «раскрывается с
 * перерендером без анимации, резкие движения»).
 *
 * Техника — `grid-template-rows: 0fr → 1fr` (тот же приём, что у панели
 * постановки в очередь): работает с ЛЮБОЙ, заранее неизвестной высотой
 * содержимого, без замеров и без `max-height`-костылей.
 *
 * Три неочевидные вещи, без которых анимации не будет:
 *   1. Монтируем ЗАКРЫТЫМ и открываем на СЛЕДУЮЩЕМ кадре — если элемент
 *      появился сразу `1fr`, анимировать нечего.
 *   2. Форс-reflow в ref-колбэке фиксирует стартовый computed `0fr`: иначе
 *      браузер склеивает `0fr→1fr` в один рекалк и перехода не будет.
 *   3. Размонтируем не сразу, а по `transitionend` — иначе исчезающий блок
 *      выдёргивается до конца анимации (ровно исходный симптом). Содержимое на
 *      время закрытия держим в ref: родитель уже мог его обнулить.
 *
 * `prefers-reduced-motion` — переход выключается (`motion-reduce`), состояния
 * меняются мгновенно.
 */
/**
 * Длительность раскрытия по умолчанию. Экспортируется, потому что владельцу
 * иногда нужно ДОЖДАТЬСЯ схлопывания, не имея на руках самого блока (строка
 * таблицы, которую снимают после того, как её тело сложилось).
 *
 * 200 мс, а не 260: с честной кривой (см. `ease-out` ниже) время тратится на
 * видимое движение, а не на асимптоту, — и прежние 260 мс читались бы уже как
 * медлительность. Это же штатная длительность переходов приложения.
 */
export const REVEAL_MS = 200

export function Reveal({
  open,
  children,
  className,
  durationMs = REVEAL_MS,
  onClosed,
}: {
  open: boolean
  children: ReactNode
  /** Классы внешней обёртки (напр. `mt-2` — отступ схлопывается вместе с ней). */
  className?: string
  durationMs?: number
  /**
   * Схлопывание доиграло и блок размонтирован. Владельцу это нужно, чтобы
   * отложить до этого момента правку, которая снесла бы содержимое (см.
   * панель постановки в очередь) — событие вместо таймера по `durationMs`.
   */
  onClosed?: () => void
}) {
  const [mounted, setMounted] = useState(open)
  // Свежая ссылка: закрытие может доиграть через кадры после последнего рендера.
  const onClosedRef = useRef(onClosed)
  onClosedRef.current = onClosed
  const close = useCallback(() => {
    setMounted(false)
    onClosedRef.current?.()
  }, [])
  /**
   * Всегда монтируемся ЗАКРЫТЫМИ — даже когда `open` уже true.
   *
   * Здесь стояло `useState(open)`, и это работало ровно до тех пор, пока
   * `Reveal` жил в дереве постоянно, а менялся только проп: тогда первый
   * монтаж всегда приходил с `open=false`. Стоит появиться владельцу, который
   * монтирует блок ВМЕСТЕ с раскрытием (строка таблицы: `tr` возникает в том
   * же коммите, что и `open=true`), — и стартовое значение оказывается `1fr`,
   * анимировать нечего, блок распахивается рывком. Стартовать закрытыми
   * безопасно для обоих случаев: при `open=false` следующий кадр всё равно
   * ничего не откроет.
   */
  const [animOpen, setAnimOpen] = useState(false)
  // Последнее НЕпустое содержимое: на закрытии родитель обычно перестаёт его
  // передавать, а анимации ещё есть что показывать.
  const lastChildren = useRef<ReactNode>(children)
  if (open && children) lastChildren.current = children

  useEffect(() => {
    if (open) setMounted(true)
    else setAnimOpen(false)
  }, [open])

  // Повторное открытие ПОСРЕДИ закрытия: узел уже смонтирован, ref-колбэк
  // больше не сработает — открываем эффектом.
  //
  // Второй, страховочный завод — таймером. `requestAnimationFrame` не приходит
  // вообще, пока вкладку не рисуют (фон, свёрнутое окно, headless-прогон), и
  // тогда раскрытие не наступает НИКОГДА: содержимое в DOM есть, высота нулевая,
  // на экране пусто — и остаётся пусто после возврата на вкладку. Таймеры в
  // таком режиме работают, поэтому 90 мс закрывают дыру. В нормальной вкладке
  // кадр приходит первым, а повторный `setAnimOpen(true)` тем же значением
  // React гасит сам — анимация от страховки не страдает.
  useEffect(() => {
    if (!mounted || !open) return
    const frame = requestAnimationFrame(() => setAnimOpen(true))
    const backstop = window.setTimeout(() => setAnimOpen(true), 90)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(backstop)
    }
  }, [mounted, open])

  const wrapRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    node.getBoundingClientRect() // форс-reflow: фиксируем стартовый 0fr
    requestAnimationFrame(() => setAnimOpen(true))
  }, [])

  // Бэкстоп: `transitionend` не придёт, если вкладка скрыта или переход отменён
  // на полпути — иначе блок остался бы смонтированным навсегда.
  useEffect(() => {
    if (open || !mounted) return
    const id = window.setTimeout(close, durationMs + 120)
    return () => window.clearTimeout(id)
  }, [open, mounted, durationMs, close])

  if (!mounted) return null

  return (
    <div
      ref={wrapRef}
      className={cn(
        /* **Кривая — `ease-out`, как у остальных 90 переходов приложения.**
           Здесь стоял `cubic-bezier(0.22,1,0.36,1)` (easeOutQuint) — единственная
           своя кривая во всём CRM, и она давала «торможение в конце»: замер на
           строке способа (170 px) показал 90 % высоты за 109 мс и оставшиеся 3 %
           за 121 мс — почти половина анимации уходила на 5 px. Хвост при этом
           двигался по 0,1 px за кадр, то есть в субпиксель: браузер округляет
           высоту до физических пикселей, и строка несколько кадров стояла на
           одном значении, дёргаясь между двумя соседними. Обычный `ease-out`
           доводит до 99 % за 94 % длительности — последний кадр смещает ~2 px,
           и приезд читается как приезд, а не как затухание. */
        'grid transition-[grid-template-rows] ease-out motion-reduce:transition-none',
        className,
      )}
      style={{
        gridTemplateRows: animOpen ? '1fr' : '0fr',
        transitionDuration: `${durationMs}ms`,
      }}
      onTransitionEnd={(e) => {
        if (e.propertyName !== 'grid-template-rows') return
        if (e.target !== e.currentTarget) return
        if (open) return
        // Проверяем, что закончилось именно СХЛОПЫВАНИЕ: `transitionend` от
        // ОТКРЫТИЯ может прийти уже после того, как `open` стал false (клик
        // ровно в момент финиша), и тогда блок размонтировался бы мгновенно —
        // без анимации закрытия, ровно исходный симптом.
        const rows = getComputedStyle(e.currentTarget).gridTemplateRows
        if (parseFloat(rows) === 0 || rows === '0px') close()
      }}
    >
      <div className="min-h-0 overflow-hidden">
        {open ? children : lastChildren.current}
      </div>
    </div>
  )
}
