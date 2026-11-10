import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bookmark,
  Bot,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Link2,
  MessageCircle,
  MessageCircleMore,
  MessageSquareText,
  Phone,
  Search,
  Send,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Avatar, CallDirectionIcon, CounterpartyAvatar, DIR_LABEL } from '@/components/crm'
import { Proposal } from '@/components/proposal'
import { cpById, staffById, threadById } from '@/mock/select'
import { ME_BY_ROLE } from '@/mock/world'
import { dayLabel, dayOf, fmtDuration, fmtGap, minutesBetween, shortDate, timeOf } from '@/lib/time'
import { useLab } from '@/lab/lab-state'
import { useNav } from '@/state/nav'
import { useStore } from '@/state/store'
import type { Counterparty, MsgChannel, MsgEvent, Thread as ThreadT, ThreadEvent, World } from '@/mock/types'
import { ownerOf } from './owner'
import { flatEpisode, periodEpisode, episodeSummary, episodesOf, RESULT_LABEL, STATUS_LABEL, waitMin, SLA_MIN, type Episode } from './episodes'

/**
 * ВІКНО ЛИСТУВАННЯ — один компонент на всі чотири точки входу (§4 брифу,
 * docs/shape.md). Дві оболонки: `drawer` (слот master-detail праворуч, як
 * картка дзвінка) і `card` (вбудоване у віджет картки контрагента). Різниця
 * тільки в шапці; стрічка, звернення і поле відповіді — ті самі.
 *
 * Поле відповіді прибите до низу оболонки: між кліками воно не їде (вимір
 * §6 — зсув 0 px).
 */

export const CHANNEL_META: Record<MsgChannel | 'call', { label: string; icon: typeof Send }> = {
  telegram: { label: 'Telegram', icon: Send },
  whatsapp: { label: 'WhatsApp', icon: MessageCircleMore },
  viber: { label: 'Viber', icon: MessageCircle },
  site: { label: 'Чат на сайті', icon: Globe },
  sms: { label: 'SMS', icon: MessageSquareText },
  'viber-notify': { label: 'Viber · сповіщення', icon: MessageCircle },
  call: { label: 'Дзвінок', icon: Phone },
}

export function ChannelGlyph({ channel, label, className }: { channel: MsgChannel; label?: boolean; className?: string }) {
  const m = CHANNEL_META[channel]
  const Icon = m.icon
  return (
    <span className={cn('inline-flex items-center gap-1 text-label text-muted-fg', className)} title={m.label}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label ? m.label : <span className="sr-only">{m.label}</span>}
    </span>
  )
}

const DELIVERY = {
  delivered: { label: 'Доставлено', variant: 'success' as const },
  queued: { label: 'У черзі', variant: 'default' as const },
  failed: { label: 'Не доставлено', variant: 'danger' as const },
}

/** Канали, якими можна відповісти: чат-канали, у які клієнт уже писав (бот не пише першим), і SMS. */
function replyChannels(t: ThreadT, cp: Counterparty | null): MsgChannel[] {
  const used = new Set<MsgChannel>()
  for (const e of t.events) if (e.kind === 'msg' && e.from === 'client' && (e.channel === 'telegram' || e.channel === 'viber' || e.channel === 'whatsapp')) used.add(e.channel)
  const out: MsgChannel[] = [...used]
  const phone = cp?.phone ?? sharedPhone(t)
  if (phone) out.push('sms')
  return out
}

function lastClientChannel(t: ThreadT): MsgChannel | null {
  for (let i = t.events.length - 1; i >= 0; i--) {
    const e = t.events[i]
    if (e.kind === 'msg' && e.from === 'client' && (e.channel === 'telegram' || e.channel === 'viber' || e.channel === 'whatsapp')) return e.channel
  }
  return null
}

function sharedPhone(t: ThreadT) {
  for (const e of t.events) if (e.kind === 'system') {
    const m = e.text.match(/контактом: (\+[\d ]+)/)
    if (m) return m[1]
  }
  return null
}

export function Thread({
  threadId,
  host,
  intent,
  onClose,
  focusEpisode,
  mode = 'episodes',
  readOnly,
}: {
  threadId: string
  host: 'drawer' | 'card'
  /**
   * `episodes` — Б: тред нарізаний на звернення. `flat` — А: один тред без меж,
   * зведення за період. `current` — В: тільки поточне звернення, решта в картці.
   */
  mode?: 'episodes' | 'flat' | 'current'
  /** В: картка — архів для читання; «Відповісти» відкриває вікно в дровері. */
  readOnly?: boolean
  intent?: 'sms' | 'reply'
  onClose?: () => void
  /** Звернення, до якого прокрутити (клік у списку звернень картки). */
  focusEpisode?: { index: number; nonce: number }
}) {
  const { world, dispatch } = useStore()
  const { role } = useLab()
  const meId = ME_BY_ROLE[role]
  const t = threadById(world, threadId)
  const cp = cpById(world, t?.counterpartyId)
  const episodes = useMemo(() => (t ? episodesOf(t, world.now) : []), [t, world.now])
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  // Старші за 30 днів звернення сховані під одну кнопку: у ЮЛ за два роки їх десятки.
  const [showOld, setShowOld] = useState(false)
  const recentFrom = episodes.findIndex((ep) => minutesBetween(ep.end, world.now) <= 30 * 24 * 60)
  const firstShown = showOld ? 0 : recentFrom === -1 ? Math.max(0, episodes.length - 1) : recentFrom

  // Т — взяти звернення й одразу писати (сцени 1 і 5 клавіатурою).
  useEffect(() => {
    if (host !== 'drawer') return
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
      if (e.key === 'Escape') {
        onClose?.()
        return
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.code === 'KeyT' && t) {
        e.preventDefault()
        const owner = ownerOf(world, t)
        if (role !== 'head' && (!owner || owner.staffId === meId)) {
          dispatch({ type: 'TAKE', threadId: t.id, staffId: meId })
          requestAnimationFrame(() => composerRef.current?.focus())
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [host, t, role, meId, dispatch, onClose, world])

  // «Наступне» у В відкриває вікно одразу для відповіді.
  useEffect(() => {
    if (intent === 'reply') requestAnimationFrame(() => composerRef.current?.focus())
  }, [intent, threadId])

  // Стрічка стоїть на кінці: остання подія — те, що зараз відбувається.
  const count = t?.events.length ?? 0
  useLayoutEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [count, threadId])

  useEffect(() => {
    if (!focusEpisode) return
    if (focusEpisode.index < firstShown) {
      setShowOld(true)
      return
    }
    feedRef.current?.querySelector(`[data-episode="${focusEpisode.index}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [focusEpisode, firstShown])

  if (!t) return null
  const flat = mode === 'flat' ? flatEpisode(t, world.now) : null
  const stripEpisodes = flat ? [flat] : episodes
  const noMessages = !t.events.some((e) => e.kind === 'msg')

  return (
    <div className="flex h-full min-h-0 flex-col" data-chat-component="thread" data-thread-host={host} data-testid="thread">
      {host === 'drawer' && <ThreadHeader world={world} t={t} cp={cp} onClose={onClose} />}
      {!cp && <BindBar world={world} t={t} />}
      <TakenStrip world={world} t={t} episodes={stripEpisodes} meId={meId} role={role} readOnly={readOnly} onTook={() => composerRef.current?.focus()} />
      {mode === 'flat' && !noMessages && (
        <div className="shrink-0 border-b border-border bg-bg/60 px-3.5 pt-2.5">
          <PeriodSummary world={world} t={t} />
        </div>
      )}
      <div ref={feedRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-bg/60 px-3.5 py-3" data-testid="thread-feed">
        {noMessages && <EmptyChat hasCalls={t.events.some((e) => e.kind === 'call')} />}
        {mode === 'flat' ? (
          <>
            <EventList world={world} events={t.events} cp={cp} t={t} />
          </>
        ) : mode === 'current' ? (
          <>
            {episodes.length > 1 && <EarlierInCard t={t} n={episodes.length - 1} host={host} />}
            {episodes.slice(-1).map((ep) => (
              <EpisodeBlock key={ep.index} world={world} ep={ep} last cp={cp} t={t} />
            ))}
          </>
        ) : (
          <>
        {firstShown > 0 && (
          <button type="button" onClick={() => setShowOld(true)} className="mb-3 w-full rounded-lg border border-dashed border-border-strong px-3 py-2 text-left text-label font-medium text-fg-2 hover:bg-card">
            Ще {firstShown} {firstShown === 1 ? 'звернення' : 'звернень'} раніше, з {shortDate(episodes[0].start)}.{episodes[0].start.slice(2, 4)}
          </button>
        )}
        {episodes.slice(firstShown).map((ep) => (
          <EpisodeBlock key={ep.index} world={world} ep={ep} last={ep.index === episodes.length - 1} cp={cp} t={t} />
        ))}
          </>
        )}
      </div>
      {readOnly ? <ReadOnlyBar t={t} /> : <Composer world={world} t={t} cp={cp} meId={meId} role={role} intent={intent} textareaRef={composerRef} />}
    </div>
  )
}

/* ─── шапка (тільки в дровері) ─────────────────────────────────────── */

function ThreadHeader({ world, t, cp, onClose }: { world: World; t: ThreadT; cp: Counterparty | null; onClose?: () => void }) {
  const { go } = useNav()
  const manager = staffById(world, cp?.managerId)
  const channels = [...new Set(t.events.flatMap((e) => (e.kind === 'msg' && e.from === 'client' ? [e.channel] : [])))]
  return (
    <header className="flex shrink-0 items-start gap-2.5 border-b border-border px-4 py-3">
      <CounterpartyAvatar cp={cp} size={8} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {cp ? (
            <button type="button" onClick={() => go({ screen: 'cp', id: cp.id })} className="flex min-w-0 items-center gap-1 text-left text-title font-semibold text-fg hover:underline">
              <span className="truncate">{cp.name}</span>
              <ExternalLink className="size-3.5 shrink-0 text-muted-fg" aria-hidden />
            </button>
          ) : (
            <span className="truncate text-title font-semibold text-fg">{t.handle?.name ? `${t.handle.name} · ` : ''}без контрагента</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-label text-muted-fg">
          <span className="tabular-nums">{cp?.phone ?? sharedPhone(t) ?? t.handle?.value}</span>
          {channels.map((c) => (
            <ChannelGlyph key={c} channel={c} label />
          ))}
          {manager && <span>Відповідальний: {manager.name}</span>}
        </div>
      </div>
      <Proposal className="mt-1" />
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрити (Esc)"
        title="Закрити (Esc)"
        className="grid size-7 shrink-0 place-items-center rounded-md text-muted-fg hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
      >
        <X className="size-4" />
      </button>
    </header>
  )
}

/* ─── клієнт без контрагента ───────────────────────────────────────── */

function BindBar({ world, t }: { world: World; t: ThreadT }) {
  const { dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const phone = sharedPhone(t)
  const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
  // Номер, яким поділився клієнт, шукає контрагента сам.
  const byPhone = phone ? world.counterparties.find((c) => digits(c.phone) === digits(phone)) : undefined
  const list = world.counterparties.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || digits(c.phone).includes(digits(q))).slice(0, 6)
  return (
    <div className="shrink-0 border-b border-border bg-warning-soft/50 px-4 py-2" data-bind-bar="">
      <div className="flex flex-wrap items-center gap-2 text-label text-fg-2">
        <AlertTriangle className="size-3.5 shrink-0 text-warning-fg" aria-hidden />
        <span className="min-w-0 flex-1">
          {phone ? <>Клієнт поділився номером <b className="tabular-nums">{phone}</b>{byPhone ? ` — знайдено ${byPhone.name}` : ' — контрагента з таким номером немає'}.</> : 'Номера немає: месенджер його не передає.'}
        </span>
        {byPhone ? (
          <button type="button" onClick={() => dispatch({ type: 'BIND', threadId: t.id, counterpartyId: byPhone.id })} className="rounded-md bg-fg px-2 py-1 text-label font-medium text-primary-fg hover:bg-fg-2" data-bind-found="">
            Привʼязати
          </button>
        ) : (
          <>
            <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-md border border-border bg-card px-2 py-1 text-label font-medium text-fg-2 hover:bg-muted" data-bind="">
              Привʼязати…
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'CREATE_TEMP', threadId: t.id, name: t.handle?.name ? `${t.handle.name} (${t.handle.value})` : t.handle?.value ?? 'Клієнт', phone })}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-label font-medium text-fg-2 hover:bg-muted"
              data-create-temp=""
            >
              <UserPlus className="size-3" aria-hidden /> Тимчасовий контрагент
            </button>
          </>
        )}
      </div>
      {open && (
        <div className="mt-2 rounded-md border border-border bg-card">
          <label className="relative flex items-center border-b border-border">
            <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-fg" aria-hidden />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Імʼя або телефон" className="h-8 w-full bg-transparent pl-8 pr-2 text-body focus-visible:outline-none" />
          </label>
          <ul className="max-h-48 overflow-y-auto py-1">
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => dispatch({ type: 'BIND', threadId: t.id, counterpartyId: c.id })} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted">
                  <CounterpartyAvatar cp={c} size={5} />
                  <span className="min-w-0 flex-1 truncate text-body text-fg">{c.name}</span>
                  <span className="text-label tabular-nums text-muted-fg">{c.phone}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ─── хто веде ─────────────────────────────────────────────────────── */

function TakenStrip({
  world,
  t,
  episodes,
  meId,
  role,
  readOnly,
  onTook,
}: {
  world: World
  t: ThreadT
  episodes: Episode[]
  meId: string
  role: string
  readOnly?: boolean
  onTook: () => void
}) {
  const { dispatch } = useStore()
  const cur = episodes[episodes.length - 1]
  const owner = ownerOf(world, t)
  const taker = staffById(world, owner?.staffId)
  const mine = owner?.staffId === meId
  const wait = waitMin(cur ?? null, world.now)
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
      {cur && <StatusBadge ep={cur} now={world.now} />}
      {wait != null && (
        <span className={cn('text-label tabular-nums', wait > SLA_MIN ? 'font-medium text-danger-fg' : 'text-warning-fg')}>без відповіді {fmtGap(wait)}</span>
      )}
      <span className="ml-auto flex items-center gap-2">
        {taker ? (
          <span className="inline-flex items-center gap-1.5 text-label text-fg-2" data-taken-by={taker.id}>
            <Avatar name={taker.name} size={5} tone={mine ? 'accent' : 'muted'} />
            {mine ? 'Веду я' : `Веде ${taker.name}`}
            {owner!.responsible ? ' · відповідальний менеджер' : ` з ${timeOf(owner!.at)}`}
          </span>
        ) : role !== 'head' && !readOnly ? (
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'TAKE', threadId: t.id, staffId: meId })
              requestAnimationFrame(onTook)
            }}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-fg px-2.5 text-label font-semibold text-primary-fg hover:bg-fg-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-1"
            data-take=""
          >
            Взяти <kbd className="rounded-sm bg-white/15 px-1 font-mono text-mono">Т</kbd>
          </button>
        ) : (
          <span className="text-label text-muted-fg">Ніхто не взяв</span>
        )}
        {!readOnly && cur && cur.status !== 'closed' && (mine || role === 'manager') && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'CLOSE', threadId: t.id })}
            className="rounded-md px-1.5 py-1 text-label font-medium text-muted-fg hover:bg-muted hover:text-fg"
            title="Закрити звернення вручну; результат система поставить сама"
          >
            Закрити звернення
          </button>
        )}
      </span>
    </div>
  )
}

export function StatusBadge({ ep, now }: { ep: Episode; now: string }) {
  if (ep.status === 'closed') {
    return (
      <Badge variant={ep.result === 'none' ? 'danger' : 'success'} data-status="closed">
        Закрите · {RESULT_LABEL[ep.result ?? 'none']}
      </Badge>
    )
  }
  const overdue = ep.status === 'waiting_us' && (waitMin(ep, now) ?? 0) > SLA_MIN
  return (
    <Badge variant={ep.status === 'waiting_us' ? (overdue ? 'danger' : 'warning') : ep.status === 'waiting_client' ? 'accent' : 'default'} data-status={ep.status}>
      {STATUS_LABEL[ep.status]}
    </Badge>
  )
}

/* ─── А: зведення за період ────────────────────────────────────────── */

const PERIODS: { days: number | null; label: string }[] = [
  { days: 7, label: '7 днів' },
  { days: 30, label: '30 днів' },
  { days: null, label: 'Усе' },
]

function PeriodSummary({ world, t }: { world: World; t: ThreadT }) {
  const [days, setDays] = useState<number | null>(7)
  const ep = periodEpisode(t, world.now, days)
  // Зведення за місяць у ЮЛ — AI-зведення з моків, решта — за правилом.
  const s = episodeSummary(ep, days === 30 ? t.summary : undefined)
  return (
    <section className="mb-2.5 max-h-40 overflow-y-auto rounded-lg border border-border bg-card px-3 py-2" data-answer-month={days === 30 ? '' : undefined}>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-mono font-semibold uppercase tracking-wider text-violet-fg">
          <Sparkles className="size-3" aria-hidden /> AI-зведення
        </span>
        <Proposal />
        <span className="ml-auto flex gap-0.5" role="radiogroup" aria-label="Період зведення">
          {PERIODS.map((p) => (
            <button
              key={p.label}
              type="button"
              role="radio"
              aria-checked={days === p.days}
              onClick={() => setDays(p.days)}
              data-walk-month={p.days === 30 ? '' : undefined}
              className={cn('rounded-md px-1.5 py-0.5 text-label font-medium', days === p.days ? 'bg-fg text-primary-fg' : 'text-fg-2 hover:bg-muted')}
            >
              {p.label}
            </button>
          ))}
        </span>
      </div>
      <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-label [overflow-wrap:anywhere]">
        <dt className="text-muted-fg">Просив</dt>
        <dd className="text-fg">{s.asked}</dd>
        <dt className="text-muted-fg">Дали</dt>
        <dd className="text-fg">{s.given}</dd>
        <dt className="text-muted-fg">Домовились</dt>
        <dd className="text-fg">{s.agreed}</dd>
        <dt className="text-muted-fg">Далі</dt>
        <dd className="font-medium text-fg">{s.next}</dd>
      </dl>
    </section>
  )
}

/* ─── В: решта звернень — у картці; картка — для читання ───────────── */

function EarlierInCard({ t, n, host }: { t: ThreadT; n: number; host: 'drawer' | 'card' }) {
  const { go } = useNav()
  const word = n === 1 ? 'звернення' : 'звернень'
  if (host !== 'drawer' || !t.counterpartyId) return <p className="mb-3 text-center text-label text-muted-fg">Ще {n} {word} раніше</p>
  return (
    <button
      type="button"
      onClick={() => go({ screen: 'cp', id: t.counterpartyId! })}
      className="mb-3 w-full rounded-lg border border-dashed border-border-strong px-3 py-2 text-left text-label font-medium text-fg-2 hover:bg-card"
    >
      Ще {n} {word} раніше — в архіві картки контрагента
    </button>
  )
}

function ReadOnlyBar({ t }: { t: ThreadT }) {
  const { openDrawer } = useNav()
  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-border bg-bg px-4 py-2">
      <span className="text-label text-muted-fg">Архів для читання. Відповідь — у вікні звернення.</span>
      <button
        type="button"
        onClick={() => openDrawer({ kind: 'thread', id: t.id })}
        className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md bg-fg px-2.5 text-label font-semibold text-primary-fg hover:bg-fg-2"
        data-reply-open=""
      >
        <Send className="size-3.5" aria-hidden /> Відповісти
      </button>
    </div>
  )
}

/* ─── стрічка ──────────────────────────────────────────────────────── */


function EmptyChat({ hasCalls }: { hasCalls: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-6 text-center" data-empty-chat="">
      <MessageSquareText className="size-5 text-subtle" aria-hidden />
      <span className="text-body text-fg-2">Клієнт нам не писав</span>
      <span className="max-w-[360px] text-label text-muted-fg">
        {hasCalls ? 'Нижче — тільки дзвінки. ' : ''}Написати першим у Telegram чи Viber не можна: бот відповідає тому, хто вже писав. SMS — можна.
      </span>
    </div>
  )
}

const PAGE = 80

function EpisodeBlock({ world, ep, last, cp, t }: { world: World; ep: Episode; last: boolean; cp: Counterparty | null; t: ThreadT }) {
  const [open, setOpen] = useState(last)
  const s = episodeSummary(ep, last && ep.index === 0 ? t.summary : undefined)
  return (
    <section className={cn('mb-3', !last && 'opacity-95')} data-episode={ep.index}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2 text-left hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
      >
        <span className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
          {open ? <ChevronDown className="size-3.5 text-muted-fg" aria-hidden /> : <ChevronRight className="size-3.5 text-muted-fg" aria-hidden />}
          <span className="text-body font-semibold text-fg">Звернення {ep.index + 1}</span>
          <span className="text-label tabular-nums text-muted-fg">
            {shortDate(ep.start)}
            {dayOf(ep.start) !== dayOf(ep.end) ? ` – ${shortDate(ep.end)}` : ''}
          </span>
          {ep.occasion && <OccasionChip code={ep.occasion.code} kind={ep.occasion.kind} />}
          <span className="ml-auto">
            <StatusBadge ep={ep} now={world.now} />
          </span>
        </span>
        <span className={cn('grid min-w-0 gap-x-2 gap-y-0.5 text-label [overflow-wrap:anywhere]', open ? 'grid-cols-[88px_minmax(0,1fr)]' : 'grid-cols-1')}>
          {open ? (
            <>
              <span className="col-span-2 mb-0.5 flex items-center gap-1 text-mono font-semibold uppercase tracking-wider text-violet-fg">
                <Sparkles className="size-3" aria-hidden /> AI-зведення <Proposal className="ml-1" />
              </span>
              <span className="text-muted-fg">Просив</span>
              <span className="text-fg">{s.asked}</span>
              <span className="text-muted-fg">Дали</span>
              <span className="text-fg">{s.given}</span>
              <span className="text-muted-fg">Домовились</span>
              <span className="text-fg">{s.agreed}</span>
              <span className="text-muted-fg">Далі</span>
              <span className="font-medium text-fg">{s.next}</span>
            </>
          ) : (
            <span className="line-clamp-1 text-muted-fg">
              {s.asked} → <span className="text-fg-2">{s.agreed === '—' ? s.next : s.agreed}</span>
            </span>
          )}
        </span>
      </button>
      {open && <EventList world={world} events={ep.events} cp={cp} t={t} />}
    </section>
  )
}

/** Події в порядку часу з розділювачами днів і пауз; довгий тред — останні 80. */
function EventList({ world, events, cp, t }: { world: World; events: ThreadEvent[]; cp: Counterparty | null; t: ThreadT }) {
  const [all, setAll] = useState(false)
  const shown = all ? events : events.slice(-PAGE)
  return (
        <div className="mt-2.5 flex flex-col gap-2">
          {!all && events.length > PAGE && (
            <button type="button" onClick={() => setAll(true)} className="self-center rounded-md px-2 py-1 text-label font-medium text-accent-fg hover:bg-muted">
              Показати ранні {events.length - PAGE}
            </button>
          )}
          {shown.map((e, i) => {
            const prev = shown[i - 1]
            const newDay = !prev || dayOf(prev.at) !== dayOf(e.at)
            const pause = prev && !newDay ? minutesBetween(prev.at, e.at) : 0
            return (
              <div key={e.id} className="flex flex-col gap-2">
                {newDay && (
                  <div className="flex items-center gap-2 text-mono font-semibold uppercase tracking-wider text-muted-fg">
                    <span className="h-px flex-1 bg-border" />
                    {dayLabel(e.at, world.now)}
                    <span className="h-px flex-1 bg-border" />
                  </div>
                )}
                {pause >= 30 && (
                  <div className="flex items-center justify-center gap-1 text-label text-subtle">
                    <Clock className="size-3" aria-hidden /> пауза {fmtGap(pause)}
                  </div>
                )}
                <Item world={world} e={e} cp={cp} t={t} />
              </div>
            )
          })}
        </div>
  )
}

function OccasionChip({ code, kind }: { code: string; kind: 'reserve' | 'rent' }) {
  const Icon = kind === 'rent' ? FileText : Bookmark
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-px text-label font-medium tabular-nums text-fg-2">
      <Icon className="size-3 text-muted-fg" aria-hidden />
      {code}
    </span>
  )
}

function Item({ world, e, cp, t }: { world: World; e: ThreadEvent; cp: Counterparty | null; t: ThreadT }) {
  const base = { 'data-thread-item': '', 'data-at': e.at }
  if (e.kind === 'system')
    return (
      <div {...base} data-channel="system" className="flex items-center justify-center gap-1.5 px-6 text-center text-label text-muted-fg">
        <Link2 className="size-3 shrink-0" aria-hidden />
        <span>
          {e.text} · {timeOf(e.at)}
        </span>
      </div>
    )
  if (e.kind === 'call') return <CallItem world={world} e={e} base={base} />
  if (e.channel === 'sms' || e.channel === 'viber-notify') return <OutgoingNotice world={world} e={e} base={base} />
  const fromClient = e.from === 'client'
  const staff = staffById(world, e.staffId)
  const who = fromClient ? (cp?.name.split(' ').slice(0, 2).join(' ') ?? t.handle?.name ?? 'Клієнт') : e.from === 'bot' ? 'Софія · бот' : staff?.name ?? 'Співробітник'
  return (
    <div {...base} data-channel={e.channel} className={cn('flex items-end gap-2', fromClient ? 'justify-start' : 'justify-end')}>
      {fromClient && <CounterpartyAvatar cp={cp} size={6} />}
      <div className={cn('flex min-w-0 max-w-[82%] flex-col', fromClient ? 'items-start' : 'items-end')}>
        <span className="mb-0.5 flex items-center gap-1.5 text-label text-muted-fg">
          {who}
          <ChannelGlyph channel={e.channel} label />
          <span className="tabular-nums">{timeOf(e.at)}</span>
        </span>
        <div
          className={cn(
            'max-w-full whitespace-pre-wrap rounded-xl px-3 py-1.5 text-body text-fg [overflow-wrap:anywhere]',
            fromClient ? 'rounded-bl-sm bg-card ring-1 ring-border' : e.from === 'bot' ? 'rounded-br-sm bg-violet-soft' : 'rounded-br-sm bg-accent-soft',
          )}
        >
          {e.text}
        </div>
      </div>
      {e.from === 'staff' && <Avatar name={staff?.name} size={6} tone="accent" />}
      {e.from === 'bot' && (
        <Avatar tone="violet" size={6}>
          <Bot />
        </Avatar>
      )}
    </div>
  )
}

function CallItem({ world, e, base }: { world: World; e: Extract<ThreadEvent, { kind: 'call' }>; base: object }) {
  const [open, setOpen] = useState(false)
  const op = staffById(world, e.operatorId)
  return (
    <div {...base} data-channel="call" className="rounded-lg border border-border bg-card px-3 py-2">
      <button type="button" onClick={() => e.transcript && setOpen((v) => !v)} className={cn('flex w-full items-start gap-2 text-left', e.transcript && 'cursor-pointer')}>
        <CallDirectionIcon dir={e.dir} className="mt-0.5 size-3.5" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-1.5 text-body text-fg">
            <span className="font-medium">{DIR_LABEL[e.dir]} дзвінок</span>
            {e.dir !== 'missed' && <span className="tabular-nums text-muted-fg">{fmtDuration(e.talkSec)}</span>}
            {e.purpose && <span className="text-muted-fg">· {e.purpose}</span>}
            {e.created && <OccasionChip code={e.created.code} kind={e.created.kind} />}
          </span>
          {e.summary && <span className="mt-0.5 block text-label text-fg-2">{e.summary}</span>}
        </span>
        <span className="shrink-0 text-right text-label text-muted-fg">
          <span className="block tabular-nums">{timeOf(e.at)}</span>
          {op && <span className="block">{op.name.split(' ')[0]}</span>}
        </span>
      </button>
      {open && e.transcript && <p className="mt-1.5 border-t border-border pt-1.5 text-label text-fg-2">{e.transcript}</p>}
    </div>
  )
}

function OutgoingNotice({ world, e, base }: { world: World; e: MsgEvent; base: object }) {
  const d = e.delivery ? DELIVERY[e.delivery] : null
  const staff = staffById(world, e.staffId)
  return (
    <div {...base} data-channel={e.channel} className="ml-auto flex w-[82%] flex-col items-end">
      <span className="mb-0.5 flex items-center gap-1.5 text-label text-muted-fg">
        {staff?.name ?? 'Система'}
        <ChannelGlyph channel={e.channel} label />
        {e.template && <span>· шаблон «{e.template}»</span>}
        <span className="tabular-nums">{timeOf(e.at)}</span>
      </span>
      <div className={cn('w-full rounded-xl rounded-br-sm border border-dashed px-3 py-1.5 text-body text-fg [overflow-wrap:anywhere]', e.delivery === 'failed' ? 'border-danger/40 bg-danger-soft/40' : 'border-border-strong bg-card')}>
        {e.text}
      </div>
      <span className="mt-1 flex items-center gap-1.5 text-label text-muted-fg">
        {d && (
          <Badge variant={d.variant} data-delivery={e.delivery}>
            {d.label}
          </Badge>
        )}
        {e.delivery === 'failed' ? 'Клієнт не отримав — зателефонуйте.' : 'Одностороннє: відповісти на нього клієнт не може.'}
      </span>
    </div>
  )
}

/* ─── поле відповіді ───────────────────────────────────────────────── */

function Composer({
  world,
  t,
  cp,
  meId,
  role,
  intent,
  textareaRef,
}: {
  world: World
  t: ThreadT
  cp: Counterparty | null
  meId: string
  role: string
  intent?: 'sms' | 'reply'
  textareaRef: React.RefObject<HTMLTextAreaElement>
}) {
  const { dispatch } = useStore()
  const options = replyChannels(t, cp)
  const preferred = (): MsgChannel | null => {
    if (intent === 'sms' && options.includes('sms')) return 'sms'
    const last = lastClientChannel(t)
    if (last && !(t.botDown && last === 'telegram')) return last
    return options.find((o) => !(t.botDown && o === 'telegram')) ?? null
  }
  const [channel, setChannel] = useState<MsgChannel | null>(preferred)
  const [text, setText] = useState(() => (intent === 'sms' && t.aiDraft ? t.aiDraft : ''))
  const [aiDraft, setAiDraft] = useState(intent === 'sms' && !!t.aiDraft)
  const owner = ownerOf(world, t)
  const takenByOther = !!owner && owner.staffId !== meId && role === 'operator'
  const isHead = role === 'head'
  const disabledReason = isHead
    ? 'Керівник читає листування; відповідає оператор або менеджер.'
    : takenByOther
      ? owner!.responsible
        ? `Клієнта веде відповідальний менеджер ${staffById(world, owner!.staffId)?.name}.`
        : `Звернення веде ${staffById(world, owner!.staffId)?.name}. Відповідати може тільки той, хто взяв.`
      : null

  if (!options.length || !channel)
    return (
      <div className="shrink-0 border-t border-border px-4 py-3 text-label text-muted-fg" data-no-reply="">
        Відповісти нікуди: клієнт не писав у месенджер, номера немає.
      </div>
    )

  const send = () => {
    const body = text.trim()
    if (!body || disabledReason) return
    const id = `sent${t.events.length}`
    dispatch({
      type: 'SEND',
      threadId: t.id,
      msg: { channel, from: 'staff', staffId: meId, text: body, ...(channel === 'sms' ? { delivery: 'queued' as const, template: aiDraft ? 'AI-підказка' : undefined } : {}) },
    })
    if (channel === 'sms') window.setTimeout(() => dispatch({ type: 'DELIVER', threadId: t.id, eventId: id, delivery: 'delivered' }), 1600)
    setText('')
    setAiDraft(false)
  }

  const askContact = () => {
    if (disabledReason) return
    dispatch({ type: 'SEND', threadId: t.id, msg: { channel, from: 'staff', staffId: meId, text: 'Щоб оформити резерв, поділіться, будь ласка, номером — кнопка «Поділитися контактом» нижче.' } })
    // Заглушка клієнта: ділиться контактом за дві секунди.
    window.setTimeout(() => dispatch({ type: 'SYSTEM', threadId: t.id, text: 'Клієнт поділився контактом: +380 66 000 81 81' }), 2000)
  }

  const botDownHere = t.botDown && channel === 'telegram'
  const botDownAny = t.botDown && lastClientChannel(t) === 'telegram'

  return (
    <div className="shrink-0 border-t border-border bg-card px-3 pb-3 pt-2" data-composer="">
      <div className="mb-1.5 flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Канал відповіді">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={channel === o}
            onClick={() => setChannel(o)}
            className={cn(
              'inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-label font-medium transition-colors',
              channel === o ? 'border-fg bg-fg text-primary-fg' : 'border-border bg-card text-fg-2 hover:bg-muted',
            )}
            data-channel-option={o}
          >
            <ChannelGlyph channel={o} className={channel === o ? 'text-primary-fg' : ''} />
            {CHANNEL_META[o].label}
          </button>
        ))}
        {!cp && !sharedPhone(t) && (channel === 'telegram' || channel === 'viber' || channel === 'whatsapp') && (
          <button type="button" onClick={askContact} disabled={!!disabledReason} className="ml-auto rounded-md px-1.5 py-0.5 text-label font-medium text-accent-fg hover:bg-accent-soft disabled:opacity-50" data-ask-contact="">
            Попросити контакт
          </button>
        )}
      </div>
      {aiDraft && (
        <div className="mb-1 flex items-center gap-1.5 text-label text-violet-fg" data-ai-draft="">
          <Sparkles className="size-3" aria-hidden /> AI-підказка за дзвінком {timeOf(t.events.filter((e) => e.kind === 'call').slice(-1)[0]?.at ?? world.now)} — виправте, якщо треба <Proposal />
        </div>
      )}
      {botDownAny && (
        <div className="mb-1.5 flex items-center gap-1.5 rounded-md bg-danger-soft px-2 py-1 text-label text-danger-fg" data-bot-down="">
          <AlertTriangle className="size-3 shrink-0" aria-hidden /> Telegram-бот недоступний: відповідь у Telegram не дійде. {channel === 'sms' ? 'Обрано SMS.' : 'Надішліть SMS.'}
        </div>
      )}
      <div className={cn('flex items-end gap-2 rounded-lg border bg-card px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-fg', disabledReason ? 'border-border bg-muted/50' : 'border-border-strong')}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          disabled={!!disabledReason}
          rows={1}
          placeholder={disabledReason ?? (channel === 'sms' ? 'SMS клієнту…' : `Відповідь у ${CHANNEL_META[channel].label}…`)}
          className="max-h-32 min-h-[22px] flex-1 resize-none bg-transparent py-0.5 text-body text-fg [field-sizing:content] placeholder:text-subtle focus-visible:outline-none disabled:cursor-not-allowed"
          data-reply-field=""
          aria-label="Поле відповіді"
        />
        <button
          type="button"
          onClick={send}
          disabled={!!disabledReason || !text.trim() || botDownHere}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-fg px-2.5 text-label font-semibold text-primary-fg hover:bg-fg-2 disabled:cursor-not-allowed disabled:opacity-40"
          data-send=""
          aria-label="Надіслати (Enter)"
          title="Надіслати (Enter)"
        >
          <Send className="size-3.5" aria-hidden />
          Надіслати
        </button>
      </div>
      {channel === 'sms' && !disabledReason && <p className="mt-1 text-label text-muted-fg">SMS тільки вихідне: відповісти на нього клієнт не зможе.</p>}
    </div>
  )
}

