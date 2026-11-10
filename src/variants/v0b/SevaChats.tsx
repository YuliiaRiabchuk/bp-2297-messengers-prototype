import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowUpRight, Bookmark, Bot, Clock, Eye, FileText, Globe, Link2, MessageCircle, MessagesSquare, Search, Send, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { Avatar, SectionCard } from '@/components/crm'
import type { HistoryLine } from '@/screens/cp/CounterpartyPage'
import { staffById } from '@/mock/select'
import { fmtGap, minutesBetween, shortDate, timeOf } from '@/lib/time'
import type { Counterparty, MsgEvent, Occasion, Summary, Thread, World } from '@/mock/types'

/**
 * Варіант 0б — прототип Севи (`stories/sketches/counterparty-chats/`, гілка
 * BP-1916) перенесено як є: модель «діалог за приводом», картка тільки для
 * читання, відповідь — у «Месенджерах», яких поки немає.
 *
 * Що змінено при перенесенні: рядки перекладено українською (у Севи вони
 * російською, у `uk.po` їх немає), діалоги виводяться з того самого треду,
 * що й в інших варіантах, — за правилом Севи: один канал, межа — привід
 * (перехід за посиланням) або пауза понад 72 год.
 */

type ChatChannel = 'telegram' | 'viber' | 'site'

const CHANNEL: Record<ChatChannel, { label: string; icon: ReactNode }> = {
  telegram: { label: 'Telegram', icon: <Send /> },
  viber: { label: 'Viber', icon: <MessageCircle /> },
  site: { label: 'Сайт', icon: <Globe /> },
}

interface Dialog {
  id: string
  channel: ChatChannel
  handle: string
  via: string
  entry: string
  occasion: Occasion | null
  messages: (MsgEvent | { id: string; kind: 'system'; at: string; text: string })[]
  open: boolean
  staff: string[]
  summary: Summary | null
}

const isChat = (c: string): c is ChatChannel => c === 'telegram' || c === 'viber' || c === 'site'
const GAP_MIN = 72 * 60

export function dialogsOf(world: World, t: Thread | null, cp: Counterparty | null): Dialog[] {
  if (!t) return []
  const out: Dialog[] = []
  const lastBy = new Map<ChatChannel, Dialog>()
  let pendingOccasion: { o: Occasion; text: string; at: string } | null = null
  for (const e of t.events) {
    if (e.kind === 'system' && e.occasion && /посиланням/.test(e.text)) {
      pendingOccasion = { o: e.occasion, text: e.text, at: e.at }
      continue
    }
    if (e.kind !== 'msg' || !isChat(e.channel)) continue
    const ch = e.channel
    let d = lastBy.get(ch)
    const prevAt = d?.messages[d.messages.length - 1].at
    if (!d || pendingOccasion || (prevAt && minutesBetween(prevAt, e.at) > GAP_MIN)) {
      d = {
        id: `d-${e.id}`,
        channel: ch,
        handle: ch === 'telegram' ? cp?.telegram ?? t.handle?.value ?? '—' : ch === 'viber' ? cp?.viber ?? t.handle?.value ?? '—' : 'номер залишено в чаті',
        via: ch === 'telegram' ? 'бот @budprokat_bot' : ch === 'viber' ? 'Viber-бот Будпрокат' : 'віджет Софії на сайті',
        entry: pendingOccasion ? `Посилання з повідомлення про ${pendingOccasion.o.kind === 'rent' ? 'оренду' : 'резерв'}` : ch === 'site' ? 'Сторінка на сайті' : 'Клієнт написав сам',
        occasion: pendingOccasion?.o ?? null,
        messages: pendingOccasion ? [{ id: `${e.id}-sys`, kind: 'system', at: pendingOccasion.at, text: pendingOccasion.text }] : [],
        open: false,
        staff: [],
        summary: null,
      }
      pendingOccasion = null
      lastBy.set(ch, d)
      out.push(d)
    }
    d.messages.push(e)
    if (e.from === 'staff' && e.staffId) {
      const n = staffById(world, e.staffId)?.name
      if (n && !d.staff.includes(n)) d.staff.push(n)
    }
  }
  // Відкритий — останній діалог, якщо остання подія менше ніж 72 год тому.
  for (const d of out) d.open = minutesBetween(d.messages[d.messages.length - 1].at, world.now) < GAP_MIN
  // Зведення в Севи — по діалогу. Зведення треду підходить, лише коли діалог один.
  if (out.length === 1 && t.summary) out[0].summary = t.summary
  return out.reverse()
}

/** Заголовок діалогу без зведення — перше повідомлення клієнта (у Севи), а якщо клієнт ще не писав — перше повідомлення взагалі. */
const firstClientText = (d: Dialog) =>
  d.messages.find((m): m is MsgEvent => m.kind === 'msg' && m.from === 'client')?.text ??
  d.messages.find((m): m is MsgEvent => m.kind === 'msg')?.text ??
  ''

function ChannelGlyph({ channel, withLabel }: { channel: ChatChannel; withLabel?: boolean }) {
  const c = CHANNEL[channel]
  return (
    <span className="inline-flex items-center gap-1 text-label text-muted-fg [&_svg]:size-3.5">
      {c.icon}
      {withLabel && c.label}
    </span>
  )
}

function OccasionChip({ o, link = true }: { o: Occasion | null; link?: boolean }) {
  if (!o) return <span className="text-label text-muted-fg">Без приводу</span>
  const Icon = o.kind === 'rent' ? FileText : Bookmark
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-label font-medium text-fg-2">
      <Icon className="size-3 text-muted-fg" aria-hidden />
      <span className="tabular-nums">{o.code}</span>
      {link && <ArrowUpRight className="size-3 text-muted-fg" aria-hidden />}
    </span>
  )
}

function groups(list: Dialog[]) {
  return [
    { key: 'rent', label: 'Оренди', items: list.filter((d) => d.occasion?.kind === 'rent') },
    { key: 'reserve', label: 'Резерви', items: list.filter((d) => d.occasion?.kind === 'reserve') },
    { key: 'general', label: 'Загальні', items: list.filter((d) => !d.occasion) },
  ].filter((g) => g.items.length)
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase()
  if (!q) return <>{text}</>
  const parts: ReactNode[] = []
  const lower = text.toLowerCase()
  let from = 0
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, from)) {
    parts.push(text.slice(from, at), <mark key={at} className="rounded-sm bg-notice-soft text-fg">{text.slice(at, at + q.length)}</mark>)
    from = at + q.length
  }
  parts.push(text.slice(from))
  return <>{parts}</>
}

const OPEN_EVENT = 'seva:open-dialog'

/** Віджет «Листування» Севи. */
export function SevaChatsWidget({ world, cp, thread }: { world: World; cp: Counterparty; thread: Thread | null }) {
  const dialogs = useMemo(() => dialogsOf(world, thread, cp), [world, thread, cp])
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const list = dialogs.filter((d) => !q || d.messages.some((m) => m.kind === 'msg' && m.text.toLowerCase().includes(q)))
  const [activeId, setActiveId] = useState<string | undefined>(groups(list)[0]?.items[0]?.id)
  const active = list.find((d) => d.id === activeId) ?? groups(list)[0]?.items[0]
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const on = (e: Event) => {
      setActiveId((e as CustomEvent<string>).detail)
      rootRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
    window.addEventListener(OPEN_EVENT, on)
    return () => window.removeEventListener(OPEN_EVENT, on)
  }, [])

  return (
    <div ref={rootRef} className="scroll-mt-4">
    <SectionCard
      icon={<MessagesSquare />}
      title="Листування"
      count={dialogs.length}
      data-testid="seva-chats"
      data-chat-component="seva-chats"
      tabs={
        dialogs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2">
            <label className="relative flex h-[30px] w-56 items-center">
              <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-fg" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Пошук по повідомленнях"
                className="h-full w-full rounded-md border border-border bg-card pl-8 pr-2 text-body placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
              />
            </label>
          </div>
        )
      }
    >
      {dialogs.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center" data-empty-chat="">
          <MessagesSquare className="size-5 text-subtle" aria-hidden />
          <span className="text-body text-fg-2">Клієнт нам не писав</span>
          <span className="max-w-[420px] text-label text-muted-fg">
            Діалог з'явиться, коли клієнт напише в Telegram, Viber або чат на сайті з номера з картки
          </span>
        </div>
      ) : (
        <div className="grid h-[560px] grid-cols-[300px_1fr]">
          <div className="min-h-0 overflow-y-auto border-r border-border/60">
            {list.length === 0 && <div className="px-3 py-8 text-center text-body text-muted-fg">У повідомленнях немає «{query.trim()}»</div>}
            {groups(list).map((g) => (
              <div key={g.key} className="px-1 pb-2">
                <div className="sticky top-0 z-10 bg-card px-2 pb-1 pt-2.5 text-label text-muted-fg">{g.label}</div>
                {g.items.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setActiveId(d.id)}
                    data-dialog={d.id}
                    className={cn('flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left transition-colors', d.id === active?.id ? 'bg-muted' : 'hover:bg-muted/50')}
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-body font-medium text-fg">
                        {d.occasion ? `${d.occasion.code} ${d.occasion.label}` : d.summary?.asked ?? firstClientText(d)}
                      </span>
                      {d.open && <span className="size-1.5 shrink-0 self-center rounded-full bg-success" title="Діалог відкритий" />}
                      <span className="shrink-0 text-label tabular-nums text-muted-fg">{shortDate(d.messages[d.messages.length - 1].at)}</span>
                    </span>
                    <ChannelGlyph channel={d.channel} withLabel />
                  </button>
                ))}
              </div>
            ))}
          </div>
          {active ? <Reader world={world} d={active} cp={cp} query={query} /> : <div />}
        </div>
      )}
    </SectionCard>
    </div>
  )
}

function Reader({ world, d, cp, query }: { world: World; d: Dialog; cp: Counterparty; query: string }) {
  const first = d.messages[0].at
  const last = d.messages[d.messages.length - 1].at
  const firstClient = d.messages.find((m) => m.kind === 'msg' && m.from === 'client')
  const firstStaff = firstClient && d.messages.find((m) => m.kind === 'msg' && m.from === 'staff' && m.at >= firstClient.at)
  const firstBot = firstClient && d.messages.find((m) => m.kind === 'msg' && m.from === 'bot' && m.at >= firstClient.at)
  const facts: [string, ReactNode][] = [
    ['Де', <><ChannelGlyph channel={d.channel} withLabel /> <span className="tabular-nums">{d.handle}</span><div className="text-label text-muted-fg">{d.via}</div></>],
    ['Як почався', d.entry],
    ['Коли', <><span className="tabular-nums">{shortDate(first)}, {timeOf(first)} — {shortDate(last)}, {timeOf(last)}</span><div className="text-label text-muted-fg">тривав {fmtGap(minutesBetween(first, last))}</div></>],
    ['Перша відповідь', <>{firstStaff ? `Співробітник: ${fmtGap(minutesBetween(firstClient!.at, firstStaff.at))}` : 'Співробітник не відповідав'}{firstBot && <div className="text-label text-muted-fg">бот: {fmtGap(minutesBetween(firstClient!.at, firstBot.at))}</div>}</>],
  ]
  return (
    <div className="flex min-h-0 flex-col" data-testid="seva-reader">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border/60 px-4 py-2.5">
        <OccasionChip o={d.occasion} />
        {d.occasion && <span className="text-body text-fg-2">{d.occasion.label}</span>}
      </div>
      <dl className="grid grid-cols-4 gap-x-4 border-b border-border/60 px-4 py-2.5">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="mb-0.5 text-label text-muted-fg">{k}</dt>
            <dd className="text-body text-fg">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {d.summary && (
          <div className="rounded-lg border border-border bg-bg px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-mono font-semibold uppercase tracking-wider text-muted-fg">
              <Sparkles className="size-3.5" aria-hidden />
              Зведення діалогу
            </div>
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-body">
              {([['Просив', d.summary.asked], ['Дали', d.summary.given], ['Домовились', d.summary.agreed], ['Далі', d.summary.next]] as const).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-fg">{k}</dt>
                  <dd className="text-fg">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          {d.messages.map((m, i) => {
            const prev = d.messages[i - 1]
            const pause = prev ? minutesBetween(prev.at, m.at) : 0
            return (
              <div key={m.id} className="flex flex-col gap-2.5">
                {pause >= 30 && (
                  <div className="flex items-center justify-center gap-1.5 text-label text-muted-fg">
                    <Clock className="size-3" aria-hidden /> Пауза {fmtGap(pause)}
                  </div>
                )}
                {m.kind === 'system' ? (
                  <div className="flex items-center justify-center gap-1.5 py-1 text-label text-muted-fg">
                    <Link2 className="size-3" aria-hidden /> {m.text} · {timeOf(m.at)}
                  </div>
                ) : (
                  <Bubble world={world} m={m} channel={d.channel} cp={cp} query={query} />
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-border/60 bg-bg px-4 py-2">
        <Eye className="size-3.5 text-muted-fg" aria-hidden />
        <span className="text-label text-muted-fg">Тільки читання. Вели: {d.staff.length ? d.staff.join(', ') : d.channel === 'site' ? 'Софія (бот)' : 'ніхто'}</span>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto gap-1"
          data-reply-seva=""
          onClick={() => toast('Вкладки «Месенджери» ще немає', 'У моделі Севи відповідь — там (BP-2297).')}
        >
          Відповісти в «Месенджерах» <ArrowUpRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function Bubble({ world, m, channel, cp, query }: { world: World; m: MsgEvent; channel: ChatChannel; cp: Counterparty; query: string }) {
  const fromClient = m.from === 'client'
  const staff = staffById(world, m.staffId)
  const who = fromClient ? cp.name.split(' ').slice(0, 2).join(' ') : m.from === 'bot' ? 'Софія · бот' : `${staff?.name} · ${staff?.team}`
  return (
    <div className={cn('flex gap-2', fromClient ? 'justify-start' : 'justify-end')}>
      {fromClient && <Avatar name={cp.name} tone="accent" size={6} />}
      <div className={cn('max-w-[72%]', !fromClient && 'text-right')}>
        <div className="mb-0.5 text-label text-muted-fg">
          {who} · {CHANNEL[channel].label} · <span className="tabular-nums">{timeOf(m.at)}</span>
        </div>
        <div
          className={cn(
            'inline-block break-words rounded-xl px-3 py-1.5 text-left text-body [overflow-wrap:anywhere]',
            fromClient ? 'rounded-tl-sm bg-muted text-fg' : m.from === 'bot' ? 'rounded-tr-sm bg-violet-soft text-fg' : 'rounded-tr-sm bg-teal-soft text-fg',
          )}
        >
          <Highlight text={m.text} query={query} />
        </div>
      </div>
      {m.from === 'staff' && <Avatar name={staff?.name} tone="teal" size={6} />}
      {m.from === 'bot' && (
        <Avatar tone="violet" size={6}>
          <Bot />
        </Avatar>
      )}
    </div>
  )
}

/** Рядки діалогів у «Історії» (сторі 4 Севи). Клік відкриває діалог у віджеті. */
export function sevaHistoryLines(world: World, cp: Counterparty | null, t: Thread): HistoryLine[] {
  return dialogsOf(world, t, cp).map((d) => ({
    key: d.id,
    at: d.messages[0].at,
    icon: <span className="inline-flex [&_svg]:size-3.5">{CHANNEL[d.channel].icon}</span>,
    where: `${CHANNEL[d.channel].label} · ${d.handle}`,
    text: (
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 text-fg">
          Діалог <OccasionChip o={d.occasion} link={false} />
          <span className="text-label text-muted-fg">{d.messages.filter((m) => m.kind === 'msg').length} повідомл.</span>
        </span>
        <span className="line-clamp-1 text-label text-muted-fg">{d.messages.some((m) => m.kind === 'msg' && m.from === 'client') ? 'Клієнт: ' : ''}{firstClientText(d)}</span>
      </span>
    ),
    who: d.staff.join(', ') || (d.channel === 'site' ? 'Софія' : '—'),
    onClick: () => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: d.id })),
  }))
}

