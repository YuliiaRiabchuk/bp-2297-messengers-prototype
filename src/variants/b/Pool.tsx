import { useMemo, useRef, useState } from 'react'
import { MessageCircle, Repeat2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Avatar, CallDateTime, CELL, ContactCell, FULL_BLEED, HEAD_CELL, PageTabCount } from '@/components/crm'
import { Proposal } from '@/components/proposal'
import { Toolbar } from '@/screens/calls/CallsPage'
import { contactsThatDay, cpById, staffById, type CallRow } from '@/mock/select'
import { ME_BY_ROLE } from '@/mock/world'
import { fmtGap, minutesBetween, shortDate, timeOf, dayOf } from '@/lib/time'
import { useLab } from '@/lab/lab-state'
import { useNav } from '@/state/nav'
import { useStore } from '@/state/store'
import type { MsgEvent, Thread, World } from '@/mock/types'
import { ChannelGlyph, StatusBadge } from './Thread'
import { episodesOf, SLA_MIN, waitMin, type Episode } from './episodes'

/**
 * Вкладка «Месенджери» варіанта Б (пропозиція): пул ЗВЕРНЕНЬ. Рядок —
 * поточне звернення клієнта; хто перший взяв, той веде (§3). Відкривається
 * в тому ж дровері, що й дзвінок.
 */

type Filter = 'open' | 'waiting' | 'mine' | 'myclients' | 'lost' | 'all'

interface PoolRow {
  t: Thread
  ep: Episode
  last: MsgEvent | null
  wait: number | null
}

const isChatThread = (t: Thread) => t.events.some((e) => e.kind === 'msg' && e.from === 'client' && e.channel !== 'sms')

export function poolRows(world: World): PoolRow[] {
  const rows: PoolRow[] = []
  for (const t of world.threads) {
    if (!isChatThread(t)) continue
    const eps = episodesOf(t, world.now)
    const ep = eps[eps.length - 1]
    const last = [...ep.events].reverse().find((e): e is MsgEvent => e.kind === 'msg') ?? null
    rows.push({ t, ep, last, wait: waitMin(ep, world.now) })
  }
  return rows
}

/** Втрачені: звернення, закриті без результату (сцена 7). Одне на клієнта — останнє. */
function lostRows(world: World): PoolRow[] {
  const rows: PoolRow[] = []
  for (const t of world.threads) {
    if (!isChatThread(t)) continue
    const ep = [...episodesOf(t, world.now)].reverse().find((e) => e.status === 'closed' && e.result === 'none')
    if (!ep) continue
    const last = [...ep.events].reverse().find((e): e is MsgEvent => e.kind === 'msg') ?? null
    rows.push({ t, ep, last, wait: null })
  }
  return rows.sort((a, b) => b.ep.end.localeCompare(a.ep.end))
}

const RANK = { waiting_us: 0, open: 1, waiting_client: 2, closed: 3 }

export function waitingCount(world: World) {
  return poolRows(world).filter((r) => r.ep.status === 'waiting_us').length
}

export function MessengersTab() {
  const { world } = useStore()
  const { role } = useLab()
  const { openDrawer, drawer } = useNav()
  const meId = ME_BY_ROLE[role]
  const [filter, setFilter] = useState<Filter>('open')
  const tbody = useRef<HTMLTableSectionElement>(null)

  const all = useMemo(() => poolRows(world), [world])
  const rows = useMemo(() => {
    if (filter === 'lost') return lostRows(world)
    const f = all.filter((r) => {
      switch (filter) {
        case 'open':
          return r.ep.status !== 'closed'
        case 'waiting':
          return r.ep.status === 'waiting_us'
        case 'mine':
          return r.t.takenBy?.staffId === meId
        case 'myclients':
          return cpById(world, r.t.counterpartyId)?.managerId === meId
        case 'all':
          return true
      }
    })
    return f.sort((a, b) => RANK[a.ep.status] - RANK[b.ep.status] || (b.wait ?? 0) - (a.wait ?? 0) || b.ep.end.localeCompare(a.ep.end))
  }, [all, filter, world, meId])

  const counts = {
    open: all.filter((r) => r.ep.status !== 'closed').length,
    waiting: all.filter((r) => r.ep.status === 'waiting_us').length,
    mine: all.filter((r) => r.t.takenBy?.staffId === meId).length,
    lost: lostRows(world).length,
  }

  const chips: { key: Filter; label: string; count?: number; hidden?: boolean; walk?: string }[] = [
    { key: 'open', label: 'Відкриті', count: counts.open },
    { key: 'waiting', label: 'Чекають відповіді', count: counts.waiting },
    { key: 'mine', label: 'Мої', count: counts.mine, hidden: role === 'head' },
    { key: 'myclients', label: 'Мої клієнти', hidden: role !== 'manager' },
    { key: 'lost', label: 'Закриті без результату', count: counts.lost, walk: 'lost' },
    { key: 'all', label: 'Усі' },
  ]

  const move = (from: HTMLElement, dir: 1 | -1) => {
    const list = [...(tbody.current?.querySelectorAll<HTMLElement>('[data-pool-row]') ?? [])]
    const i = list.indexOf(from)
    list[i + dir]?.focus()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="messengers">
      <Toolbar placeholder="Пошук по клієнту чи тексту" />
      <div className="-mt-1 flex shrink-0 flex-wrap items-center gap-1 px-4 pb-2.5" role="tablist" aria-label="Звернення">
          {chips
            .filter((c) => !c.hidden)
            .map((c) => (
              <button
                key={c.key}
                type="button"
                role="tab"
                aria-selected={filter === c.key}
                onClick={() => setFilter(c.key)}
                data-walk-lost={c.walk === 'lost' ? '' : undefined}
                className={cn(
                  'inline-flex h-[30px] items-center gap-1.5 rounded-md border px-2.5 text-body font-medium transition-colors',
                  filter === c.key ? 'border-fg bg-fg text-primary-fg' : 'border-border bg-card text-fg-2 hover:bg-muted',
                )}
              >
                {c.label}
                {c.count != null && c.count > 0 && (
                  <span className={cn('text-mono tabular-nums', filter === c.key ? 'text-primary-fg/80' : c.key === 'waiting' ? 'text-warning-fg' : 'text-muted-fg')}>{c.count}</span>
                )}
              </button>
            ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto" data-lost-list={filter === 'lost' ? '' : undefined}>
        <table className={cn('w-full min-w-[860px] table-fixed border-separate border-spacing-0', FULL_BLEED)}>
          <colgroup>
            <col style={{ width: 64 }} />
            <col style={{ width: 220 }} />
            <col />
            <col style={{ width: 168 }} />
            <col style={{ width: 104 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 84 }} />
          </colgroup>
          <thead>
            <tr>
              <th className={HEAD_CELL}>Канал</th>
              <th className={HEAD_CELL}>Контрагент</th>
              <th className={HEAD_CELL}>Останнє повідомлення</th>
              <th className={HEAD_CELL}>Статус</th>
              <th className={cn(HEAD_CELL, 'text-right')}>Без відповіді</th>
              <th className={HEAD_CELL}>Хто веде</th>
              <th className={HEAD_CELL}>Час</th>
            </tr>
          </thead>
          <tbody ref={tbody}>
            {rows.map((r) => {
              const cp = cpById(world, r.t.counterpartyId)
              const taker = staffById(world, r.t.takenBy?.staffId)
              const overdue = r.wait != null && r.wait > SLA_MIN
              const active = drawer?.kind === 'thread' && drawer.id === r.t.id
              const lastStaff = r.last && r.last.from !== 'client' ? staffById(world, r.last.staffId) : null
              return (
                <tr
                  key={r.t.id + r.ep.index}
                  tabIndex={0}
                  data-pool-row=""
                  data-thread={r.t.id}
                  data-overdue={overdue ? '' : undefined}
                  onClick={() => openDrawer({ kind: 'thread', id: r.t.id })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openDrawer({ kind: 'thread', id: r.t.id })
                    else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      move(e.currentTarget, 1)
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      move(e.currentTarget, -1)
                    }
                  }}
                  className={cn(
                    'cursor-pointer outline-none focus-visible:bg-accent-soft focus-visible:shadow-[inset_2px_0_0_var(--color-fg)]',
                    active ? 'bg-accent-soft' : overdue ? 'bg-danger-soft/40 hover:bg-danger-soft/60' : 'hover:bg-muted/50',
                  )}
                >
                  <td className={CELL}>
                    <span className="flex items-center gap-1">
                      {r.ep.channels
                        .filter((c) => c !== 'sms' && c !== 'viber-notify')
                        .map((c) => (
                          <ChannelGlyph key={c} channel={c} />
                        ))}
                    </span>
                  </td>
                  <td className={cn(CELL, 'relative')}>
                    {cp ? (
                      <ContactCell cp={cp} />
                    ) : (
                      <div className="flex items-center gap-2">
                        <Avatar tone="warning" size={6} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-fg">{r.t.handle?.name ?? r.t.handle?.value}</span>
                          <span className="block truncate text-label text-warning-fg">{r.t.handle?.value} · без контрагента</span>
                        </span>
                      </div>
                    )}
                  </td>
                  <td className={CELL}>
                    <span className="flex min-w-0 items-center gap-1.5">
                      {r.ep.occasion && <Badge variant="outline">{r.ep.occasion.code}</Badge>}
                      <span className="truncate">
                        <span className="text-muted-fg">{r.last?.from === 'client' ? '' : `${lastStaff?.name.split(' ')[0] ?? 'Бот'}: `}</span>
                        {r.last?.text}
                      </span>
                    </span>
                  </td>
                  <td className={CELL}>
                    <StatusBadge ep={r.ep} now={world.now} />
                  </td>
                  <td className={cn(CELL, 'text-right tabular-nums')}>
                    {r.wait != null ? <span className={cn(overdue ? 'font-semibold text-danger-fg' : 'text-warning-fg')}>{fmtGap(r.wait)}</span> : <span className="text-subtle">—</span>}
                  </td>
                  <td className={CELL}>
                    {taker ? (
                      <span className="flex min-w-0 items-center gap-1.5" data-taken-by={taker.id}>
                        <Avatar name={taker.name} size={5} tone={taker.id === meId ? 'accent' : 'muted'} />
                        <span className="truncate text-label">{taker.id === meId ? 'Я' : taker.name}</span>
                      </span>
                    ) : (
                      <span className="rounded-md border border-dashed border-border-strong px-1.5 py-0.5 text-label text-muted-fg">Нічиє</span>
                    )}
                  </td>
                  <td className={CELL}>
                    <CallDateTime date={dayOf(r.ep.end) !== dayOf(world.now) ? shortDate(r.ep.end) : undefined} time={timeOf(r.ep.end)} />
                  </td>
                </tr>
              )
            })}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-body text-subtle">
                  {filter === 'waiting' ? 'Усім відповіли.' : 'Звернень немає.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function MessengersTabLabel({ world }: { world: World }) {
  const n = waitingCount(world)
  return (
    <>
      <Proposal />
      {n > 0 && <PageTabCount tone="warning">{n}</PageTabCount>}
    </>
  )
}

/* ─── «Пропущені»: повідомлення без відповіді понад SLA ─────────────── */

export function missedMessageRows(world: World) {
  return poolRows(world).filter((r) => r.wait != null && r.wait > SLA_MIN)
}

export function MissedMessageRows() {
  const { world } = useStore()
  const { openDrawer, go } = useNav()
  return (
    <>
      {missedMessageRows(world).map((r) => {
        const cp = cpById(world, r.t.counterpartyId)
        const taker = staffById(world, r.t.takenBy?.staffId)
        return (
          <tr key={r.t.id} onClick={() => openDrawer({ kind: 'thread', id: r.t.id })} className="cursor-pointer bg-danger-soft/30 hover:bg-danger-soft/50" data-missed-msg="" data-thread={r.t.id}>
            <td className={CELL}>
              <MessageCircle className="size-4 text-danger-fg" aria-label="Повідомлення без відповіді" />
            </td>
            <td className={cn(CELL, 'relative')}>
              <ContactCell cp={cp} phone={r.t.handle?.value} emphasizePhone onOpen={() => cp && go({ screen: 'cp', id: cp.id })} />
            </td>
            <td className={CELL}>
              <span className="flex flex-wrap items-center gap-1">
                <Badge variant="danger">Без відповіді</Badge>
                <Proposal />
              </span>
            </td>
            <td className={CELL}>
              {taker ? <span className="text-label">{taker.name}</span> : <span className="rounded-md border border-dashed border-border-strong px-1.5 py-0.5 text-label text-muted-fg">Не призначено</span>}
            </td>
            <td className={cn(CELL, 'text-subtle')}>—</td>
            <td className={CELL}>
              <span className="font-medium text-danger-fg">прострочено на {fmtGap((r.wait ?? 0) - SLA_MIN)}</span>
            </td>
            <td className={CELL}>
              <CallDateTime time={timeOf(r.ep.waitingSince!)} />
            </td>
          </tr>
        )
      })}
    </>
  )
}

/* ─── журнал «Усі»: BP-2300 і BP-2301 ──────────────────────────────── */

export function ContactCount({ r }: { r: CallRow }) {
  const n = contactsThatDay(r.thread, r.call.at)
  if (n < 2) return null
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-muted px-1 py-0.5 text-mono font-medium tabular-nums text-fg-2"
      title={`${n}-й контакт клієнта за день: дзвінки й переписки (BP-2300, пропозиція)`}
      aria-label={`${n}-й контакт за день`}
    >
      <Repeat2 className="size-3 opacity-60" aria-hidden />
      <span data-contact-count="">{n}</span>
    </span>
  )
}

export function ChatCell({ r }: { r: CallRow }) {
  const { openDrawer } = useNav()
  const { world } = useStore()
  const t = r.thread
  const last = [...t.events].reverse().find((e): e is MsgEvent => e.kind === 'msg')
  const hasChat = isChatThread(t)
  const intent = t.aiDraft || !hasChat ? 'sms' : undefined
  const ago = last ? minutesBetween(last.at, world.now) : null
  return (
    <button
      type="button"
      data-chat-cell=""
      onClick={(e) => {
        e.stopPropagation()
        openDrawer({ kind: 'thread', id: t.id, intent })
      }}
      className="group flex w-full min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left hover:bg-muted"
    >
      {last ? (
        <>
          <ChannelGlyph channel={last.channel} />
          <span className="min-w-0 flex-1 truncate text-label text-fg-2">{last.text}</span>
          {ago != null && ago < 24 * 60 && <span className="shrink-0 text-mono text-muted-fg">{timeOf(last.at)}</span>}
        </>
      ) : (
        <span className="text-label font-medium text-accent-fg group-hover:underline">Написати</span>
      )}
    </button>
  )
}
