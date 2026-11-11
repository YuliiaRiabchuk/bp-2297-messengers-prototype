import { useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Maximize2,
  Minus,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  PictureInPicture2,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CounterpartyAvatar } from '@/components/crm'
import { Proposal } from '@/components/proposal'
import { cpById, staffById, threadById } from '@/mock/select'
import { ME_BY_ROLE } from '@/mock/world'
import { dayOf, fmtDuration, minutesBetween, shortDate, timeOf, toDate } from '@/lib/time'
import { useLab } from '@/lab/lab-state'
import { useNav } from '@/state/nav'
import { useStore } from '@/state/store'
import type { MsgChannel, MsgEvent, Occasion, Thread, ThreadEvent, World } from '@/mock/types'
import { CHANNEL_META } from '../chat/Thread'
import { episodeSummary, episodesOf, type Episode } from '../chat/episodes'
import { ownerOf, ownerOfLast, type OwnerEx } from '../chat/owner'

/**
 * Простий чат як у Telegram. Один компонент — дровер пулу, віджет поверх CRM,
 * вкладка «Комунікації» картки. Три смаки:
 *  - Г — PM-синк 10.11: мінімум підписів;
 *  - Д — коментарі Уракова: на кожному повідомленні канал, напрям і відправник
 *        (BP-2437 зберігає відправника), чат можна згорнути у віджет;
 *  - Е — Д + планування 10.11: дзвінок із суттю й обладнанням, діалог іде
 *        тому, хто спілкувався останнім, у картці — 30 днів короткими тредами.
 */
export type Flavor = 'Г' | 'Д' | 'Е'
type Host = 'drawer' | 'card' | 'widget'

const CHAT = new Set<MsgChannel>(['telegram', 'viber', 'whatsapp'])
const visible = (e: ThreadEvent) => e.kind !== 'system'

/** Назва каналу для підпису (Д, Е): SMS — явно через TurboSMS, щоб не було «незрозумілої зони». */
const CHANNEL_LABEL: Record<MsgChannel, string> = {
  telegram: 'Telegram',
  viber: 'Viber',
  whatsapp: 'WhatsApp',
  site: 'Сайт',
  sms: 'SMS · TurboSMS',
  'viber-notify': 'Viber · TurboSMS',
}

export const ownerFor = (flavor: Flavor) => (flavor === 'Е' ? ownerOfLast : ownerOf) as (w: World, t: Thread) => OwnerEx | null

function dayPill(iso: string, now: string) {
  const d = dayOf(iso)
  if (d === dayOf(now)) return 'Сьогодні'
  const y = toDate(now)
  y.setDate(y.getDate() - 1)
  if (toDate(iso).toDateString() === y.toDateString()) return 'Вчора'
  const sameYear = d.slice(0, 4) === dayOf(now).slice(0, 4)
  return toDate(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: sameYear ? undefined : 'numeric' })
}

function lastOccasion(t: Thread): Occasion | null {
  for (let i = t.events.length - 1; i >= 0; i--) {
    const e = t.events[i]
    const o = e.kind === 'call' ? e.created : e.kind === 'system' ? e.occasion : undefined
    if (o) return o
  }
  return null
}

export function SimpleChat({
  threadId,
  host,
  intent,
  onClose,
  flavor = 'Г',
}: {
  threadId: string
  host: Host
  intent?: 'sms' | 'reply'
  onClose?: () => void
  flavor?: Flavor
}) {
  const { world } = useStore()
  const t = threadById(world, threadId)
  const feed = useRef<HTMLDivElement>(null)
  const count = t?.events.length ?? 0
  useLayoutEffect(() => {
    if (feed.current) feed.current.scrollTop = feed.current.scrollHeight
  }, [count, threadId])
  if (!t) return null
  const threads = flavor === 'Е' && host === 'card'

  return (
    <div className="flex h-full min-h-0 flex-col" data-chat-component="simple-chat" data-testid="thread">
      <Header world={world} t={t} host={host} flavor={flavor} onClose={onClose} />
      <div ref={feed} className="min-h-0 flex-1 overflow-y-auto bg-muted/50 px-4 py-3" data-testid="thread-feed">
        <div className={cn('mx-auto flex flex-col gap-1', host === 'card' && 'max-w-[760px]')}>
          {!t.events.some((e) => e.kind === 'msg') && (
            <p className="my-4 text-center text-label text-muted-fg" data-empty-chat="">
              Клієнт ще не писав.{t.events.length ? ' Нижче — дзвінки.' : ''}
            </p>
          )}
          {threads ? <Threads30 world={world} t={t} flavor={flavor} /> : <Feed world={world} events={t.events.filter(visible)} flavor={flavor} />}
        </div>
      </div>
      <Composer world={world} t={t} intent={intent} flavor={flavor} />
    </div>
  )
}

function Feed({ world, events, flavor }: { world: World; events: ThreadEvent[]; flavor: Flavor }) {
  const [all, setAll] = useState(false)
  const shown = all ? events : events.slice(-80)
  return (
    <>
      {!all && events.length > shown.length && (
        <button type="button" onClick={() => setAll(true)} className="mx-auto mb-2 rounded-full bg-card px-3 py-1 text-label font-medium text-fg-2 shadow-sm hover:text-fg">
          Раніші ({events.length - shown.length})
        </button>
      )}
      {shown.map((e, i) => {
        const prev = shown[i - 1]
        const newDay = !prev || dayOf(prev.at) !== dayOf(e.at)
        return (
          <div key={e.id} className="flex flex-col">
            {newDay && <span className="mx-auto my-2 rounded-full bg-card/80 px-2.5 py-0.5 text-label font-medium text-fg-2 shadow-sm">{dayPill(e.at, world.now)}</span>}
            <Item world={world} e={e} flavor={flavor} />
          </div>
        )
      })}
    </>
  )
}

/* ─── Е: 30 днів короткими тредами, деталі останнього звернення ─────── */

function Threads30({ world, t, flavor }: { world: World; t: Thread; flavor: Flavor }) {
  const eps = episodesOf(t, world.now)
  const recent = eps.filter((e) => minutesBetween(e.end, world.now) <= 30 * 24 * 60)
  const last = eps[eps.length - 1]
  const older = eps.length - recent.length - (recent.includes(last) ? 0 : 1)
  const shortList = recent.filter((e) => e !== last)
  return (
    <>
      {older > 0 && <p className="mx-auto mb-1 text-label text-muted-fg">Раніше — ще {older} звернень; у хронології лише 30 днів</p>}
      {shortList.map((ep) => (
        <ShortThread key={ep.index} world={world} ep={ep} flavor={flavor} />
      ))}
      {last && (
        <section className="mt-2" data-last-episode="">
          <span className="mx-auto mb-2 block w-fit rounded-full bg-card/80 px-2.5 py-0.5 text-label font-medium text-fg-2 shadow-sm">
            Останнє звернення · {shortDate(last.start)}
            {dayOf(last.start) !== dayOf(last.end) ? `–${shortDate(last.end)}` : ''}
          </span>
          <Feed world={world} events={last.events.filter(visible)} flavor={flavor} />
        </section>
      )}
    </>
  )
}

function ShortThread({ world, ep, flavor }: { world: World; ep: Episode; flavor: Flavor }) {
  const [open, setOpen] = useState(false)
  const s = episodeSummary(ep, undefined, world.now)
  const staff = [...new Set(ep.events.flatMap((e) => (e.kind === 'msg' && e.from === 'staff' && e.staffId ? [e.staffId] : e.kind === 'call' && e.operatorId ? [e.operatorId] : [])))]
    .map((id) => staffById(world, id)?.name.split(' ')[0])
    .filter(Boolean)
  const calls = ep.events.filter((e) => e.kind === 'call').length
  const msgs = ep.events.filter((e) => e.kind === 'msg').length
  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-2 rounded-xl bg-card px-3 py-2 text-left text-label shadow-sm hover:ring-1 hover:ring-border-strong"
      >
        {open ? <ChevronDown className="mt-0.5 size-3.5 shrink-0 text-muted-fg" aria-hidden /> : <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-fg" aria-hidden />}
        <span className="w-[74px] shrink-0 tabular-nums text-fg-2">
          {shortDate(ep.start)}
          {dayOf(ep.start) !== dayOf(ep.end) ? `–${shortDate(ep.end)}` : ''}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 text-fg">{s.asked !== '—' ? s.asked : s.agreed !== '—' ? s.agreed : s.given}</span>
          <span className="text-muted-fg">
            {[calls && `${calls} дзв.`, msgs && `${msgs} повід.`, staff.length && `вели ${staff.join(', ')}`].filter(Boolean).join(' · ')}
          </span>
        </span>
        {ep.occasion && <span className="shrink-0 tabular-nums text-muted-fg">{ep.occasion.code}</span>}
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-1 pl-4">
          <Feed world={world} events={ep.events.filter(visible)} flavor={flavor} />
        </div>
      )}
    </div>
  )
}

/* ─── шапка ─────────────────────────────────────────────────────────── */

function Header({ world, t, host, flavor, onClose }: { world: World; t: Thread; host: Host; flavor: Flavor; onClose?: () => void }) {
  const { go, openDrawer, setDock } = useNav()
  const { dispatch } = useStore()
  const { role } = useLab()
  const meId = ME_BY_ROLE[role]
  const cp = cpById(world, t.counterpartyId)
  const owner = ownerFor(flavor)(world, t)
  const taker = staffById(world, owner?.staffId)
  const occ = lastOccasion(t)
  const [open, setOpen] = useState(false)
  const eps = episodesOf(t, world.now)
  const last = eps[eps.length - 1]
  const s = last && episodeSummary(last, eps.length === 1 ? t.summary : undefined, world.now)
  const tgBusiness = flavor === 'Е' && t.events.some((e) => e.kind === 'msg' && e.channel === 'telegram')
  const showName = host === 'drawer'
  const lead = taker && (
    <span className="shrink-0 text-label text-fg-2" data-taken-by={taker.id} title={owner?.lastContact ? 'Діалог іде тому, з ким клієнт спілкувався останнім' : undefined}>
      {taker.id === meId ? 'Веду я' : `Веде ${host === 'widget' ? taker.name.split(' ')[0] : taker.name}`}
      {owner?.lastContact && <span className="text-muted-fg"> · останній контакт</span>}
      {owner?.responsible && <span className="text-muted-fg"> · відповідальний</span>}
    </span>
  )
  const meta = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-label text-muted-fg">
      <span className="tabular-nums">{cp?.phone ?? t.handle?.value}</span>
      {!cp && <span className="text-warning-fg">номера немає — попросіть поділитися контактом</span>}
      {occ && host !== 'widget' && (
        <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 text-fg-2">
          {occ.kind === 'rent' ? <FileText className="size-3" aria-hidden /> : <Bookmark className="size-3" aria-hidden />}
          {occ.kind === 'rent' ? 'Оренда' : 'Резерв'} {occ.code}
        </span>
      )}
      {tgBusiness && host !== 'widget' && (
        <span title="Клієнт пише в реальний акаунт номера (Telegram Business, BP-2437)">пише на Telegram Business · 067 000 00 67</span>
      )}
    </div>
  )

  return (
    <header className="shrink-0 border-b border-border bg-card">
      <div className={cn('flex items-center gap-2.5', host === 'widget' ? 'px-3 py-2' : 'px-4 py-2.5')}>
        {showName && <CounterpartyAvatar cp={cp} size={8} />}
        <div className="min-w-0 flex-1">
          {showName &&
            (cp ? (
              <button type="button" onClick={() => go({ screen: 'cp', id: cp.id })} className="flex min-w-0 max-w-full items-center gap-1 text-title font-semibold text-fg hover:underline">
                <span className="truncate">{cp.name}</span>
                <ExternalLink className="size-3.5 shrink-0 text-muted-fg" aria-hidden />
              </button>
            ) : (
              <span className="block truncate text-title font-semibold text-fg">{t.handle?.name ?? t.handle?.value}</span>
            ))}
          {host !== 'drawer' && meta}
        </div>
        {taker ? (
          host !== 'drawer' && lead
        ) : (
          role !== 'head' && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'TAKE', threadId: t.id, staffId: meId })}
              className="h-7 shrink-0 rounded-md border border-border bg-card px-2.5 text-label font-medium text-fg-2 hover:bg-muted"
              data-take=""
            >
              Взяти
            </button>
          )
        )}
        {s && host !== 'widget' && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={cn('inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-label font-medium', open ? 'bg-violet-soft text-violet-fg' : 'text-fg-2 hover:bg-muted')}
            data-walk-month=""
            title="Підсумок останньої розмови"
          >
            <Sparkles className="size-3.5" aria-hidden /> Підсумок
          </button>
        )}
        {host === 'drawer' && flavor !== 'Г' && (
          <button
            type="button"
            onClick={() => {
              setDock(t.id)
              openDrawer(null)
            }}
            aria-label="Згорнути у віджет"
            title="Згорнути у віджет: чат лишиться відкритим, поки ви працюєте в CRM"
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted-fg hover:bg-muted hover:text-fg"
            data-dock=""
          >
            <PictureInPicture2 className="size-4" />
          </button>
        )}
        {host === 'drawer' && (
          <button type="button" onClick={onClose} aria-label="Закрити" className="grid size-7 shrink-0 place-items-center rounded-md text-muted-fg hover:bg-muted hover:text-fg">
            <X className="size-4" />
          </button>
        )}
      </div>
      {host === 'drawer' && (
        <div className="-mt-1.5 flex flex-col gap-0.5 px-4 pb-2 pl-[62px]">
          {meta}
          {lead}
        </div>
      )}
      {open && s && (
        <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-2 gap-y-0.5 border-t border-border bg-violet-soft/40 px-4 py-2 text-label [overflow-wrap:anywhere]" data-answer-month="">
          <dt className="text-muted-fg">Просив</dt>
          <dd className="text-fg">{s.asked}</dd>
          <dt className="text-muted-fg">Дали</dt>
          <dd className="text-fg">{s.given}</dd>
          <dt className="text-muted-fg">Домовились</dt>
          <dd className="text-fg">{s.agreed}</dd>
          <dt className="text-muted-fg">Далі</dt>
          <dd className="font-medium text-fg">{s.next}</dd>
          <dd className="col-span-2 mt-0.5 flex items-center gap-1 text-muted-fg">
            AI, остання розмова <Proposal />
          </dd>
        </dl>
      )}
    </header>
  )
}

/** Віджет чату поверх CRM (Д, Е): лишається, поки оператор ходить по каталогу, орендах, резервах. */
export function ChatWidget({ threadId, flavor }: { threadId: string; flavor: Flavor }) {
  const { setDock, openDrawer } = useNav()
  const { world } = useStore()
  const [min, setMin] = useState(false)
  const t = threadById(world, threadId)
  const cp = cpById(world, t?.counterpartyId)
  if (!t) return null
  return (
    <div
      className={cn('fixed bottom-4 right-4 z-[60] flex flex-col overflow-hidden rounded-xl border border-border-strong bg-card shadow-dialog', min ? 'w-72' : 'h-[min(520px,calc(100vh-2rem))] w-[380px]')}
      data-chat-widget=""
      role="dialog"
      aria-label="Чат із клієнтом"
    >
      <div className="flex shrink-0 items-center gap-1 border-b border-border bg-fg px-3 py-1.5 text-primary-fg">
        <span className="min-w-0 flex-1 truncate text-label font-semibold">{cp?.name ?? t.handle?.name ?? t.handle?.value}</span>
        <button type="button" onClick={() => setMin((v) => !v)} aria-label={min ? 'Розгорнути' : 'Згорнути'} className="grid size-6 place-items-center rounded hover:bg-white/15">
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setDock(null)
            openDrawer({ kind: 'thread', id: t.id })
          }}
          aria-label="Відкрити в дровері"
          className="grid size-6 place-items-center rounded hover:bg-white/15"
        >
          <Maximize2 className="size-3.5" />
        </button>
        <button type="button" onClick={() => setDock(null)} aria-label="Закрити віджет" className="grid size-6 place-items-center rounded hover:bg-white/15">
          <X className="size-3.5" />
        </button>
      </div>
      {!min && <SimpleChat threadId={t.id} host="widget" flavor={flavor} />}
    </div>
  )
}

/* ─── стрічка ───────────────────────────────────────────────────────── */

function Item({ world, e, flavor }: { world: World; e: ThreadEvent; flavor: Flavor }) {
  const base = { 'data-thread-item': '', 'data-at': e.at }
  const rich = flavor !== 'Г'
  if (e.kind === 'call') {
    const op = staffById(world, e.operatorId)
    const Icon = e.dir === 'missed' ? PhoneMissed : e.dir === 'out' ? PhoneOutgoing : PhoneIncoming
    const ours = e.dir === 'out'
    return (
      <div {...base} data-channel="call" className={cn('my-0.5 flex', ours ? 'justify-end' : 'justify-start')}>
        <div className="flex max-w-[82%] items-start gap-2 rounded-2xl bg-card px-3 py-1.5 text-body shadow-sm">
          <Icon className={cn('mt-0.5 size-4 shrink-0', e.dir === 'missed' ? 'text-danger-fg' : e.dir === 'out' ? 'text-accent-fg' : 'text-success-fg')} aria-hidden />
          <span className="min-w-0">
            {/* Е: у транскрибованому дзвінку — суть, а не просто «дзвінок». */}
            {flavor === 'Е' && e.summary ? (
              <span className="block text-fg">{e.summary}</span>
            ) : (
              <span className={cn('font-medium', e.dir === 'missed' ? 'text-danger-fg' : 'text-fg')}>
                {e.dir === 'missed' ? 'Пропущений дзвінок' : e.dir === 'out' ? 'Вихідний дзвінок' : 'Вхідний дзвінок'}
              </span>
            )}
            {flavor === 'Е' && e.equipment?.length ? (
              <span className="mt-0.5 flex flex-wrap gap-1">
                {e.equipment.map((x) => (
                  <span key={x} className="rounded-md bg-muted px-1.5 text-label text-fg-2">
                    {x}
                  </span>
                ))}
              </span>
            ) : null}
            {flavor !== 'Е' && e.summary && <span className="block text-label text-fg-2">{e.summary}</span>}
            <span className="block text-label text-muted-fg">
              {flavor === 'Е' && e.summary ? (e.dir === 'out' ? 'Вихідний дзвінок' : 'Вхідний дзвінок') : null}
              {e.dir !== 'missed' && (
                <>
                  {flavor === 'Е' && e.summary ? ' · ' : ''}
                  {fmtDuration(e.talkSec)}
                  {op ? ` · ${op.name.split(' ')[0]}` : ''}
                </>
              )}
            </span>
          </span>
          <span className="mt-1 shrink-0 text-mono tabular-nums text-muted-fg">{timeOf(e.at)}</span>
        </div>
      </div>
    )
  }
  if (e.kind !== 'msg') return null
  const ours = e.from !== 'client'
  const Icon = CHANNEL_META[e.channel].icon
  const sender = e.from === 'bot' ? 'Софія (бот)' : e.from === 'staff' ? staffById(world, e.staffId)?.name ?? 'Система' : null
  return (
    <div {...base} data-channel={e.channel} className={cn('flex', ours ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[78%] whitespace-pre-wrap rounded-2xl px-3 py-1.5 text-body text-fg shadow-sm [overflow-wrap:anywhere]',
          ours ? (e.from === 'bot' ? 'bg-violet-soft' : 'bg-accent-soft') : 'bg-card',
          e.delivery === 'failed' && 'ring-1 ring-danger/50',
        )}
      >
        {e.text}
        {rich ? (
          // Д, Е: канал, напрям і відправник — на кожному повідомленні (Ураков, BP-2437).
          <span className="mt-1 flex flex-wrap items-center justify-end gap-x-1 text-mono leading-tight text-muted-fg" data-msg-meta="">
            {ours ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownLeft className="size-3" aria-hidden />}
            <span>{ours ? 'Вихідне' : 'Вхідне'}</span>
            <span>·</span>
            <Icon className="size-3" aria-hidden />
            <span>{CHANNEL_LABEL[e.channel]}</span>
            {sender && (
              <>
                <span>·</span>
                <span className="text-fg-2" data-sender="">
                  {e.channel === 'viber-notify' ? 'автоматично' : sender}
                </span>
              </>
            )}
            <span>·</span>
            <span className="tabular-nums">{timeOf(e.at)}</span>
            {e.delivery && <Delivery e={e} />}
          </span>
        ) : (
          <span className="float-right ml-2 mt-1.5 inline-flex items-center gap-1 text-mono leading-none tabular-nums text-muted-fg" title={`${CHANNEL_META[e.channel].label}${e.from === 'bot' ? ' · бот' : ''}`}>
            <Icon className="size-3" aria-hidden />
            {timeOf(e.at)}
            {e.delivery && <Delivery e={e} />}
          </span>
        )}
      </div>
    </div>
  )
}

function Delivery({ e }: { e: MsgEvent }) {
  if (e.delivery === 'failed')
    return (
      <span className="font-medium text-danger-fg" data-delivery="failed">
        не доставлено
      </span>
    )
  return e.delivery === 'delivered' ? (
    <CheckCheck className="size-3 text-accent-fg" aria-label="Доставлено" data-delivery="delivered" />
  ) : (
    <Check className="size-3" aria-label="У черзі" data-delivery="queued" />
  )
}

/* ─── поле відповіді ────────────────────────────────────────────────── */

function lastChatChannel(t: Thread): MsgChannel | null {
  for (let i = t.events.length - 1; i >= 0; i--) {
    const e = t.events[i]
    if (e.kind === 'msg' && e.from === 'client' && CHAT.has(e.channel)) return e.channel
  }
  return null
}

function Composer({ world, t, intent, flavor }: { world: World; t: Thread; intent?: 'sms' | 'reply'; flavor: Flavor }) {
  const { dispatch } = useStore()
  const { role } = useLab()
  const meId = ME_BY_ROLE[role]
  const cp = cpById(world, t.counterpartyId)
  const chat = lastChatChannel(t)
  const channel: MsgChannel | null = intent === 'sms' && cp?.phone ? 'sms' : chat ?? (cp?.phone ? 'sms' : null)
  const [text, setText] = useState(() => (intent === 'sms' && t.aiDraft ? t.aiDraft : ''))
  const owner = ownerOf(world, t)
  const other = owner && owner.staffId !== meId && role === 'operator'
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    if (intent) ref.current?.focus()
  }, [intent])

  if (role === 'head') return <p className="shrink-0 border-t border-border px-4 py-2.5 text-label text-fg-2">Керівник читає; відповідає оператор або менеджер.</p>
  if (other) return <p className="shrink-0 border-t border-border px-4 py-2.5 text-label text-fg-2">Розмову веде {staffById(world, owner!.staffId)?.name}.</p>
  if (!channel) return <p className="shrink-0 border-t border-border px-4 py-2.5 text-label text-muted-fg">Відповісти нікуди: немає ні месенджера, ні номера.</p>

  const send = () => {
    const body = text.trim()
    if (!body) return
    const id = `sent${t.events.length}`
    dispatch({ type: 'SEND', threadId: t.id, msg: { channel, from: 'staff', staffId: meId, text: body, ...(channel === 'sms' ? { delivery: 'queued' as const } : {}) } })
    if (channel === 'sms') window.setTimeout(() => dispatch({ type: 'DELIVER', threadId: t.id, eventId: id, delivery: 'delivered' }), 1600)
    setText('')
  }
  const Icon = CHANNEL_META[channel].icon
  const label = flavor === 'Г' ? CHANNEL_META[channel].label : `${CHANNEL_LABEL[channel]}${flavor === 'Е' && channel === 'telegram' ? ' Business' : ''}`
  return (
    <div className="shrink-0 border-t border-border bg-card px-3 py-2">
      {intent === 'sms' && t.aiDraft && text === t.aiDraft && (
        <p className="mb-1 flex items-center gap-1 text-label text-violet-fg" data-ai-draft="">
          <Sparkles className="size-3" aria-hidden /> Текст запропонував AI за дзвінком — виправте, якщо треба
        </p>
      )}
      <div className="flex items-end gap-2">
        <span className="mb-1.5 inline-flex shrink-0 items-center gap-1 text-label text-muted-fg" title={channel === 'sms' ? 'SMS: відповісти на нього клієнт не зможе' : `Відповідь піде в ${CHANNEL_META[channel].label}`}>
          <Icon className="size-3.5" aria-hidden />
          {label}
        </span>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={1}
          placeholder={flavor === 'Г' ? 'Повідомлення…' : `Повідомлення від ${staffById(world, meId)?.name.split(' ')[0] ?? 'вас'}…`}
          aria-label="Поле відповіді"
          data-reply-field=""
          className="max-h-32 min-h-[34px] flex-1 resize-none rounded-2xl border border-border bg-bg px-3 py-1.5 text-body text-fg [field-sizing:content] placeholder:text-muted-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim()}
          aria-label="Надіслати (Enter)"
          data-send=""
          className="grid size-[34px] shrink-0 place-items-center rounded-full bg-fg text-primary-fg hover:bg-fg-2 disabled:opacity-30"
        >
          <Send className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
