import { useEffect, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronsLeftRight,
  Copy,
  EyeOff,
  FlaskConical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARD_LAYOUTS, useLab } from './lab-state'
import { ROLES, ROLE_LABEL, VARIANTS } from './variants'
import { SCENES } from './scenes'

/**
 * Перемикач кадрів у стилі дев-тулзів.
 *
 * Це ІНСТРУМЕНТ, не частина продукту. Тому: `position: fixed` з власним
 * стековим контекстом, нуль впливу на потік сторінки під ним, і повне
 * зникнення по Ctrl+. — у кадрі для бізнесу його бути не має.
 *
 * Перемикає три речі: варіант, сцену і роль. Усе це пишеться в URL, тож будь-який кадр
 * відтворюється посиланням.
 */
export function LabWidget() {
  const lab = useLab()
  // Згорнутий за замовчуванням: розгорнута панель перекриває контент, а
  // перекривати те, що нею ж і порівнюють, інструмент не має права.
  const [collapsed, setCollapsed] = useState(true)
  // Бік стикування. Правий нижній кут це рейл, лівий — низ фокус-панелі;
  // що б не розглядали, панель має бути куди відсунути.
  const [dock, setDock] = useState<'left' | 'right'>(() => {
    try {
      return window.localStorage.getItem('bp-messengers.lab.dock') === 'right' ? 'right' : 'left'
    } catch {
      return 'left'
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem('bp-messengers.lab.dock', dock)
    } catch {
      /* сховище недоступне */
    }
  }, [dock])
  /**
   * Віджет тримається КРАЮ РОБОЧОЇ ОБЛАСТІ, а не краю вікна.
   *
   * На широкому моніторі сторінка впирається в 1520px і центрується, тож
   * `left-4` відносив інструмент на кількасот пікселів убік від контенту —
   * у порожнє поле, де його не видно. `max()` притискає його до вікна лише
   * тоді, коли поля справді немає.
   */
  // Прив'язка за ДАЛЬНІМ краєм, а не за ближнім.
  //
  // Було `left: margin - 1rem` — тобто лівий край віджета ставав на межу
  // робочої області, і сам віджет лягав ПОВЕРХ контенту на всю свою ширину.
  // Тепер за межу відсувається його правий край (для лівого доку), тож у
  // поле він входить цілком або не входить взагалі.
  /**
   * Прив'язка з ОБМЕЖЕННЯМ, а не просто за дальнім краєм.
   *
   * Прив'язка «правий край на межу робочої області» ставила віджет цілком
   * поза контентом — і разом із тим цілком поза екраном: розгорнута панель
   * шириною 21rem не вміщалась у поле і виїжджала за лівий край вікна. Було
   * видно смужку в кілька пікселів, решта — за кадром.
   *
   * `max()` тримає обидві умови: віджет стає збоку від робочої області, якщо
   * поле це дозволяє, і не ближче за 1rem до краю вікна в будь-якому разі.
   * Ширина панелі (21rem) закладена в розрахунок — саме її не вистачало.
   */
  const dockSide =
    dock === 'left'
      ? 'left-[max(1rem,calc(50%-var(--container-page)/2-22rem))]'
      : 'right-[max(1rem,calc(50%-var(--container-page)/2-22rem))]'

  const [copied, setCopied] = useState(false)

  if (lab.hidden) return null

  const describe = `варіант ${lab.variant} — сцена ${
    SCENES.find((s) => s.id === lab.sceneId)?.n ?? '?'
  } — ${ROLE_LABEL[lab.role].toLowerCase()}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* буфер недоступний — рядок усе одно видно в підвалі віджета */
    }
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Розгорнути перемикач кадрів"
        className={cn(
          // Темна заливка, а не картка: інструмент має відрізнятись від
          // продукту під ним і знаходитись з першого погляду. Бліда колба на
          // світлому тлі губилась на широкому екрані, де віджет відʼїжджає в
          // порожнє поле збоку від робочої області.
          // Угорі — тільки там, де збоку СПРАВДІ є поле.
          //
          // Робоча область впирається в 1680px. Щоб віджет став збоку
          // ЦІЛКОМ, поля має вистачити на його ширину з відступом — це
          // приблизно 1960px. Вужче за це він стоїть унизу, де контенту
          // немає: угорі він накривав то назву оренди, то заголовок кадру
          // помилки, тобто інструмент зʼїдав продукт.
          'fixed bottom-4 min-[1960px]:bottom-auto min-[1960px]:top-4',
          'z-tooltip inline-flex items-center gap-2 rounded-full bg-fg py-2.5 pl-4 pr-5 text-body font-semibold text-primary-fg shadow-dialog transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100',
          dockSide,
        )}
      >
        <FlaskConical className="size-5 shrink-0" aria-hidden />
        Кадри
      </button>
    )
  }

  return (
    <aside
      className={cn(
        'fixed bottom-4 min-[1960px]:bottom-auto min-[1960px]:top-4 z-tooltip flex max-h-[calc(100vh-2rem)] w-[21rem] flex-col overflow-hidden rounded-lg border border-border-strong bg-card shadow-dialog',
        dockSide,
      )}
      aria-label="Перемикач кадрів"
      data-lab-widget=""
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <FlaskConical className="size-3.5 shrink-0 text-muted-fg" aria-hidden />
        <span className="text-mono font-semibold uppercase tracking-[0.04em] text-muted-fg">
          Кадри
        </span>
        <div className="ml-auto flex items-center gap-1">
          <IconBtn
            label={dock === 'left' ? 'Пересунути праворуч' : 'Пересунути ліворуч'}
            onClick={() => setDock((d) => (d === 'left' ? 'right' : 'left'))}
          >
            <ChevronsLeftRight className="size-3.5" aria-hidden />
          </IconBtn>
          <IconBtn
            label="Сховати цілком (Ctrl+.)"
            onClick={() => lab.setHidden(true)}
          >
            <EyeOff className="size-3.5" aria-hidden />
          </IconBtn>
          <IconBtn label="Згорнути в іконку" onClick={() => setCollapsed(true)}>
            <ChevronDown className="size-3.5" aria-hidden />
          </IconBtn>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* ── Варіант ──────────────────────────────────────────────── */}
        <section className="border-b border-border px-3 py-2.5">
          <Label>Варіант</Label>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {VARIANTS.map((v) => (
              <Chip
                key={v.code}
                active={lab.variant === v.code}
                onClick={() => lab.setVariant(v.code)}
                title={v.note}
              >
                {v.code} {v.label}
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-label text-muted-fg">
            {VARIANTS.find((v) => v.code === lab.variant)?.note}
          </p>
        </section>

        {/* ── Сцена ─────────────────────────────────────────────────── */}
        <section className="border-b border-border px-3 py-2.5">
          <Label>Сцена</Label>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {SCENES.filter((s) => !s.edge).map((s) => (
              <Chip
                key={s.id}
                active={lab.sceneId === s.id}
                onClick={() => lab.setScene(s.id)}
                title={s.proves}
              >
                {s.n}. {s.title}
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-label text-muted-fg">
            {SCENES.find((s) => s.id === lab.sceneId)?.proves}
          </p>
          <div className="mt-2">
            <Label>Крайні стани</Label>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {SCENES.filter((s) => s.edge).map((s) => (
              <Chip key={s.id} active={lab.sceneId === s.id} onClick={() => lab.setScene(s.id)} title={s.proves}>
                {s.title}
              </Chip>
            ))}
          </div>
        </section>

        {/* ── Картка (Q3) ───────────────────────────────────────────── */}
        <section className="border-b border-border px-3 py-2.5">
          <Label>Картка · листування</Label>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {CARD_LAYOUTS.map((c) => (
              <Chip key={c.key} active={lab.card === c.key} onClick={() => lab.setCard(c.key)} title={c.note} disabled={lab.variant.startsWith('0') || ['Г', 'Д', 'Е'].includes(lab.variant)}>
                {c.label}
              </Chip>
            ))}
          </div>
          <p className="mt-1.5 text-label text-muted-fg">
            {['Г', 'Д', 'Е'].includes(lab.variant) ? 'У Г, Д, Е — завжди окрема вкладка «Комунікації» (PM-синк 10.11).' : lab.variant.startsWith('0') ? 'Для А, Б, В: у 0 і 0б листування в картці таке, як є.' : CARD_LAYOUTS.find((c) => c.key === lab.card)?.note}
          </p>
        </section>

        {/* ── Роль ──────────────────────────────────────────────────── */}
        <section className="px-3 py-2.5">
          <Label>Роль</Label>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {ROLES.map((r) => (
              <Chip key={r} active={lab.role === r} onClick={() => lab.setRole(r)}>
                {ROLE_LABEL[r]}
              </Chip>
            ))}
          </div>
        </section>
      </div>

      <footer className="flex items-center gap-2 border-t border-border bg-muted/40 px-3 py-2">
        <code className="min-w-0 flex-1 truncate text-mono text-muted-fg">
          {describe}
        </code>
        <button
          type="button"
          onClick={copy}
          className="flex shrink-0 items-center gap-1 rounded-sm border border-border bg-card px-2 py-1 text-mono text-fg-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
        >
          {copied ? (
            <>
              <Check className="size-3 text-success-fg" aria-hidden />
              посилання скопійовано
            </>
          ) : (
            <>
              <Copy className="size-3" aria-hidden />
              посилання
            </>
          )}
        </button>
      </footer>
    </aside>
  )
}

/* ─── Дрібні примітиви віджета ─────────────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-mono font-semibold uppercase tracking-[0.04em] text-fg-2">
      {children}
    </span>
  )
}

function Chip({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-label transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg',
        active
          ? 'border-fg bg-fg text-primary-fg'
          : 'border-border bg-card text-fg-2 hover:bg-muted',
        disabled && 'cursor-not-allowed opacity-45 hover:bg-card',
      )}
    >
      {children}
    </button>
  )
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-6 place-items-center rounded-sm text-muted-fg transition-colors hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
    >
      {children}
    </button>
  )
}
