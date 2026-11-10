import { useLayoutEffect, useRef, useState } from 'react'
import { Bookmark, Check, CheckCheck, ExternalLink, FileText, PhoneIncoming, PhoneMissed, PhoneOutgoing, Send, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CounterpartyAvatar } from '@/components/crm'
import { Proposal } from '@/components/proposal'
import { cpById, staffById, threadById } from '@/mock/select'
import { ME_BY_ROLE } from '@/mock/world'
import { dayOf, fmtDuration, timeOf, toDate } from '@/lib/time'
import { useLab } from '@/lab/lab-state'
import { useNav } from '@/state/nav'
import { useStore } from '@/state/store'
import type { MsgChannel, MsgEvent, Occasion, Thread, ThreadEvent, World } from '@/mock/types'
import { CHANNEL_META } from '../chat/Thread'
import { episodeSummary, episodesOf } from '../chat/episodes'
import { ownerOf } from '../chat/owner'

/**
 * Варіант Г: чат як у Telegram (PM-синк 10.11). Один компонент — і в дровері
 * пулу, і на вкладці «Комунікації» картки. Дзвінки й повідомлення в одній
 * стрічці по днях; канал — іконка біля часу; без службових рядків.
 */

const CHAT = new Set<MsgChannel>(['telegram', 'viber', 'whatsapp'])

/** Що потрапляє в стрічку: повідомлення й дзвінки. Службові рядки — ні. */
const visible = (e: ThreadEvent) => e.kind !== 'system'

function dayPill(iso: string, now: string) {
  const d = dayOf(iso)
  if (d === dayOf(now)) return 'Сьогодні'
  const y = toDate(now)
  y.setDate(y.getDate() - 1)
  if (toDate(iso).toDateString() === y.toDateString()) return 'Вчора'
  const sameYear = d.slice(0, 4) === dayOf(now).slice(0, 4)
  return toDate(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: sameYear ? undefined : 'numeric' })
}

/** Логічний елемент розмови — резерв чи оренда, якої вона стосується (чіп у шапці). */
function lastOccasion(t: Thread): Occasion | null {
  for (let i = t.events.length - 1; i >= 0; i--) {
    const e = t.events[i]
    const o = e.kind === 'call' ? e.created : e.kind === 'system' ? e.occasion : undefined
    if (o) return o
  }
  return null
}

export function SimpleChat({ threadId, host, intent, onClose }: { threadId: string; host: 'drawer' | 'card'; intent?: 'sms' | 'reply'; onClose?: () => void }) {
  const { world } = useStore()
  const t = threadById(world, threadId)
  const feed = useRef<HTMLDivElement>(null)
  const [all, setAll] = useState(false)
  const count = t?.events.length ?? 0
  useLayoutEffect(() => {
    if (feed.current) feed.current.scrollTop = feed.current.scrollHeight
  }, [count, threadId])
  if (!t) return null
  const events = t.events.filter(visible)
  const shown = all ? events : events.slice(-80)

  return (
    <div className="flex h-full min-h-0 flex-col" data-chat-component="simple-chat" data-testid="thread">
      <Header world={world} t={t} host={host} onClose={onClose} />
      <div ref={feed} className="min-h-0 flex-1 overflow-y-auto bg-muted/50 px-4 py-3" data-testid="thread-feed">
        <div className={cn('mx-auto flex flex-col gap-1', host === 'card' && 'max-w-[760px]')}>
          {!events.some((e) => e.kind === 'msg') && (
            <p className="my-4 text-center text-label text-muted-fg" data-empty-chat="">
              Клієнт ще не писав.{events.length ? ' Нижче — дзвінки.' : ''}
            </p>
          )}
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
                {newDay && (
                  <span className="mx-auto my-2 rounded-full bg-card/80 px-2.5 py-0.5 text-label font-medium text-fg-2 shadow-sm">{dayPill(e.at, world.now)}</span>
                )}
                <Item world={world} e={e} />
              </div>
            )
          })}
        </div>
      </div>
      <Composer world={world} t={t} intent={intent} />
    </div>
  )
}

/* ─── шапка: клієнт, хто веде, підсумок ─────────────────────────────── */

function Header({ world, t, host, onClose }: { world: World; t: Thread; host: 'drawer' | 'card'; onClose?: () => void }) {
  const { go } = useNav()
  const { dispatch } = useStore()
  const { role } = useLab()
  const meId = ME_BY_ROLE[role]
  const cp = cpById(world, t.counterpartyId)
  const owner = ownerOf(world, t)
  const taker = staffById(world, owner?.staffId)
  const occ = lastOccasion(t)
  const [open, setOpen] = useState(false)
  const eps = episodesOf(t, world.now)
  const last = eps[eps.length - 1]
  const s = last && episodeSummary(last, eps.length === 1 ? t.summary : undefined, world.now)

  return (
    <header className="shrink-0 border-b border-border">
      <div className="flex items-center gap-2.5 px-4 py-2.5">
        {host === 'drawer' && <CounterpartyAvatar cp={cp} size={8} />}
        <div className="min-w-0 flex-1">
          {host === 'drawer' ? (
            cp ? (
              <button type="button" onClick={() => go({ screen: 'cp', id: cp.id })} className="flex min-w-0 items-center gap-1 text-title font-semibold text-fg hover:underline">
                <span className="truncate">{cp.name}</span>
                <ExternalLink className="size-3.5 shrink-0 text-muted-fg" aria-hidden />
              </button>
            ) : (
              <span className="block truncate text-title font-semibold text-fg">{t.handle?.name ?? t.handle?.value}</span>
            )
          ) : null}
          <div className="flex flex-wrap items-center gap-x-2 text-label text-muted-fg">
            <span className="tabular-nums">{cp?.phone ?? t.handle?.value}</span>
            {!cp && <span className="text-warning-fg">номера немає — попросіть поділитися контактом</span>}
            {occ && (
              <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 text-fg-2">
                {occ.kind === 'rent' ? <FileText className="size-3" aria-hidden /> : <Bookmark className="size-3" aria-hidden />}
                {occ.kind === 'rent' ? 'Оренда' : 'Резерв'} {occ.code}
              </span>
            )}
          </div>
        </div>
        {taker ? (
          <span className="shrink-0 text-label text-fg-2" data-taken-by={taker.id}>
            {taker.id === meId ? 'Веду я' : `Веде ${taker.name}`}
          </span>
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
        {s && (
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
        {host === 'drawer' && (
          <button type="button" onClick={onClose} aria-label="Закрити" className="grid size-7 shrink-0 place-items-center rounded-md text-muted-fg hover:bg-muted hover:text-fg">
            <X className="size-4" />
          </button>
        )}
      </div>
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

/* ─── стрічка ───────────────────────────────────────────────────────── */

function Item({ world, e }: { world: World; e: ThreadEvent }) {
  const base = { 'data-thread-item': '', 'data-at': e.at }
  if (e.kind === 'call') {
    const op = staffById(world, e.operatorId)
    const Icon = e.dir === 'missed' ? PhoneMissed : e.dir === 'out' ? PhoneOutgoing : PhoneIncoming
    const ours = e.dir === 'out'
    return (
      <div {...base} data-channel="call" className={cn('my-0.5 flex', ours ? 'justify-end' : 'justify-start')}>
        <div className="flex max-w-[82%] items-start gap-2 rounded-2xl bg-card px-3 py-1.5 text-body shadow-sm">
          <Icon className={cn('mt-0.5 size-4 shrink-0', e.dir === 'missed' ? 'text-danger-fg' : e.dir === 'out' ? 'text-accent-fg' : 'text-success-fg')} aria-hidden />
          <span className="min-w-0">
            <span className={cn('font-medium', e.dir === 'missed' ? 'text-danger-fg' : 'text-fg')}>
              {e.dir === 'missed' ? 'Пропущений дзвінок' : e.dir === 'out' ? 'Вихідний дзвінок' : 'Вхідний дзвінок'}
            </span>
            {e.dir !== 'missed' && <span className="text-muted-fg"> · {fmtDuration(e.talkSec)}{op ? ` · ${op.name.split(' ')[0]}` : ''}</span>}
            {e.summary && <span className="block text-label text-fg-2">{e.summary}</span>}
          </span>
          <span className="mt-1 shrink-0 text-mono tabular-nums text-muted-fg">{timeOf(e.at)}</span>
        </div>
      </div>
    )
  }
  if (e.kind !== 'msg') return null
  const ours = e.from !== 'client'
  const Icon = CHANNEL_META[e.channel].icon
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
        <span className="float-right ml-2 mt-1.5 inline-flex items-center gap-1 text-mono leading-none tabular-nums text-muted-fg" title={`${CHANNEL_META[e.channel].label}${e.from === 'bot' ? ' · бот' : ''}`}>
          <Icon className="size-3" aria-hidden />
          {timeOf(e.at)}
          {e.delivery && <Delivery e={e} />}
        </span>
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

function Composer({ world, t, intent }: { world: World; t: Thread; intent?: 'sms' | 'reply' }) {
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
          {CHANNEL_META[channel].label}
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
          placeholder="Повідомлення…"
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
