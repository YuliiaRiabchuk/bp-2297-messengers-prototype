import { useEffect, useMemo, useRef, useState } from 'react'
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
import { episodesOf, flatEpisode, periodEpisode, SLA_MIN, waitMin, type Episode } from './episodes'
import { ESCALATE_MIN, ownerOf } from './owner'

/**
 * Вкладка «Месенджери» (пропозиція). Хто перший взяв, той веде (§3);
 * відкривається в тому ж дровері, що й дзвінок. Три види:
 *  - А — пул КЛІЄНТІВ: рядок — тред клієнта, без меж звернень;
 *  - Б — пул ЗВЕРНЕНЬ: рядок — поточне звернення;
 *  - В — ЧЕРГА з SLA: ті самі звернення за дедлайном, «Наступне» (N).
 */
export type PoolKind = 'A' | 'Б' | 'В'
const QUIET_MIN = 72 * 60

type Filter = 'open' | 'waiting' | 'mine' | 'myclients' | 'lost' | 'all'

interface PoolRow {
  t: Thread
  ep: Episode
  last: MsgEvent | null
  wait: number | null
}

const isChatThread = (t: Thread) => t.events.some((e) => e.kind === 'msg' && e.from === 'client' && e.channel !== 'sms')

export function poolRows(world: World, kind: PoolKind = 'Б'): PoolRow[] {
  const rows: PoolRow[] = []
  for (const t of world.threads) {
    if (!isChatThread(t)) continue
    const eps = kind === 'A' ? [flatEpisode(t, world.now)] : episodesOf(t, world.now)
    const ep = eps[eps.length - 1]
    const last = [...ep.events].reverse().find((e): e is MsgEvent => e.kind === 'msg') ?? null
    rows.push({ t, ep, last, wait: waitMin(ep, world.now) })
  }
  return rows
}

/**
 * Втрачені (сцена 7). Б і В: звернення, закриті без результату, одне на
 * клієнта. А закритих не знає — замінник: у треді понад 72 год без руху (хто
 * б не мовчав — клієнт чи ми), і за місяць не з'явилось ні резерву, ні оренди.
 */
function lostRows(world: World, kind: PoolKind = 'Б'): PoolRow[] {
  const rows: PoolRow[] = []
  if (kind === 'A') {
    for (const r of poolRows(world, 'A'))
      if (minutesBetween(r.ep.end, world.now) > QUIET_MIN && !periodEpisode(r.t, world.now, 30).result) rows.push(r)
    return rows.sort((a, b) => b.ep.end.localeCompare(a.ep.end))
  }
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

/** Клієнти з відповідальним менеджером — його черга, доки він не мовчить понад годину (Q6). */
const managerOwned = (world: World, r: PoolRow) => !!ownerOf(world, r.t)?.responsible

export function waitingCount(world: World, kind: PoolKind = 'Б') {
  // Число на вкладці — те саме, що на фільтрі «Чекають відповіді»: двох лічильників одного факту не буває.
  return poolRows(world, kind).filter((r) => r.ep.status === 'waiting_us').length
}

const isOpen = (r: PoolRow, kind: PoolKind, now: string) =>
  kind === 'A' ? r.ep.status === 'waiting_us' || minutesBetween(r.ep.end, now) <= QUIET_MIN : r.ep.status !== 'closed'
const isWaiting = (r: PoolRow, kind: PoolKind) => (kind === 'В' ? r.wait != null && r.wait > SLA_MIN : r.ep.status === 'waiting_us')

const LABELS: Record<PoolKind, { open: string; waiting: string; lost: string; due: string }> = {
  A: { open: 'Активні', waiting: 'Без відповіді', lost: 'Без руху понад 72 год', due: 'Без відповіді' },
  Б: { open: 'Відкриті', waiting: 'Чекають відповіді', lost: 'Закриті без результату', due: 'Без відповіді' },
  В: { open: 'Черга', waiting: 'Прострочені SLA', lost: 'Закриті без результату', due: 'Дедлайн' },
}

export function MessengersTab({ kind = 'Б' }: { kind?: PoolKind }) {
  const { world, dispatch } = useStore()
  const { role } = useLab()
  const { openDrawer, drawer } = useNav()
  const meId = ME_BY_ROLE[role]
  const [filter, setFilter] = useState<Filter>('open')
  const tbody = useRef<HTMLTableSectionElement>(null)
  const L = LABELS[kind]
  // Відкритий дровер стискає пул до ~600 px: ховаємо текст і статус (вони є у вікні),
  // лишаємо те, за чим оператор обирає наступного, — таймер і «хто веде».
  const narrow = drawer != null

  const all = useMemo(() => poolRows(world, kind), [world, kind])
  const rows = useMemo(() => {
    if (filter === 'lost') return lostRows(world, kind)
    const f = all.filter((r) => {
      switch (filter) {
        case 'open':
          return isOpen(r, kind, world.now)
        case 'waiting':
          return isWaiting(r, kind)
        case 'mine':
          return ownerOf(world, r.t)?.staffId === meId
        case 'myclients':
          return cpById(world, r.t.counterpartyId)?.managerId === meId
        case 'all':
          return true
      }
    })
    // Нічиї й мої — вище чужих: оператор бачить зверху те, що може взяти.
    const foreign = (r: PoolRow) => { const o = ownerOf(world, r.t); return o && o.staffId !== meId ? 1 : 0 }
    return f.sort((a, b) => RANK[a.ep.status] - RANK[b.ep.status] || foreign(a) - foreign(b) || (b.wait ?? 0) - (a.wait ?? 0) || b.ep.end.localeCompare(a.ep.end))
  }, [all, filter, world, meId, kind])

  const counts = {
    open: all.filter((r) => isOpen(r, kind, world.now)).length,
    waiting: all.filter((r) => isWaiting(r, kind)).length,
    mine: all.filter((r) => ownerOf(world, r.t)?.staffId === meId).length,
    lost: lostRows(world, kind).length,
  }

  const chips: { key: Filter; label: string; count?: number; hidden?: boolean; walk?: string }[] = [
    { key: 'open', label: L.open, count: counts.open },
    { key: 'waiting', label: L.waiting, count: counts.waiting },
    { key: 'mine', label: 'Мої', count: counts.mine, hidden: role === 'head' },
    { key: 'myclients', label: 'Мої клієнти', hidden: role !== 'manager' },
    { key: 'lost', label: L.lost, count: counts.lost, walk: 'lost' },
    { key: 'all', label: 'Усі' },
  ]

  // В: «Наступне» — найтерміновіше нічиє звернення: взяти й одразу писати.
  const nextRow = kind === 'В' && role !== 'head' ? all.filter((r) => r.ep.status === 'waiting_us' && !ownerOf(world, r.t)).sort((a, b) => (b.wait ?? 0) - (a.wait ?? 0))[0] : undefined
  const takeNext = () => {
    if (!nextRow) return
    dispatch({ type: 'TAKE', threadId: nextRow.t.id, staffId: meId })
    openDrawer({ kind: 'thread', id: nextRow.t.id, intent: 'reply' })
  }
  useEffect(() => {
    if (kind !== 'В') return
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
      if (drawer?.kind === 'thread') return
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyN') {
        e.preventDefault()
        takeNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const move = (from: HTMLElement, dir: 1 | -1) => {
    const list = [...(tbody.current?.querySelectorAll<HTMLElement>('[data-pool-row]') ?? [])]
    const i = list.indexOf(from)
    list[i + dir]?.focus()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="messengers">
      <Toolbar placeholder="Пошук по клієнту чи тексту">
        {kind === 'В' && role !== 'head' && (
          <button
            type="button"
            onClick={takeNext}
            disabled={!nextRow}
            data-next=""
            className="ml-auto inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-md bg-fg px-3 text-body font-semibold text-primary-fg hover:bg-fg-2 disabled:cursor-not-allowed disabled:opacity-40"
            title={nextRow ? `Взяти найтерміновіше нічиє звернення (N): ${cpById(world, nextRow.t.counterpartyId)?.name ?? nextRow.t.handle?.name ?? 'клієнт'}` : 'Нічиїх звернень, що чекають, немає'}
          >
            Наступне <kbd className="rounded-sm bg-white/15 px-1 font-mono text-mono">N</kbd>
          </button>
        )}
      </Toolbar>
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
        <table className={cn('w-full table-fixed border-separate border-spacing-0', narrow ? 'min-w-0' : 'min-w-[860px]', FULL_BLEED)}>
          <colgroup>
            <col style={{ width: 64 }} />
            <col style={{ width: narrow ? undefined : 220 }} />
            {!narrow && <col />}
            {!narrow && <col style={{ width: 168 }} />}
            <col style={{ width: narrow ? 120 : 124 }} />
            <col style={{ width: narrow ? 136 : 150 }} />
            <col style={{ width: 92 }} />
          </colgroup>
          <thead>
            <tr>
              <th className={HEAD_CELL}>Канал</th>
              <th className={HEAD_CELL}>Контрагент</th>
              {!narrow && <th className={HEAD_CELL}>Останнє повідомлення</th>}
              {!narrow && <th className={HEAD_CELL}>Статус</th>}
              <th className={cn(HEAD_CELL, 'text-right')}>{L.due}</th>
              <th className={HEAD_CELL}>Хто веде</th>
              <th className={HEAD_CELL}>Час</th>
            </tr>
          </thead>
          <tbody ref={tbody}>
            {rows.map((r) => {
              const cp = cpById(world, r.t.counterpartyId)
              const owner = ownerOf(world, r.t)
              const taker = staffById(world, owner?.staffId)
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
                  {!narrow && <td className={CELL}>
                    <span className="flex min-w-0 items-center gap-1.5">
                      {r.ep.occasion && <Badge variant="outline">{r.ep.occasion.code}</Badge>}
                      <span className="truncate">
                        <span className="text-muted-fg">{r.last?.from === 'client' ? '' : `${lastStaff?.name.split(' ')[0] ?? 'Бот'}: `}</span>
                        {r.last?.text}
                      </span>
                    </span>
                  </td>}
                  {!narrow && <td className={CELL}>
                    <StatusBadge ep={r.ep} now={world.now} />
                  </td>}
                  <td className={cn(CELL, 'text-right tabular-nums')}>
                    {r.wait == null ? (
                      <span className="text-muted-fg">—</span>
                    ) : kind === 'В' ? (
                      <span
                        className={cn('whitespace-nowrap', overdue ? 'font-semibold text-danger-fg' : 'text-warning-fg')}
                        data-sla=""
                        title={overdue ? `прострочено на ${fmtGap(r.wait - SLA_MIN)}` : `через ${fmtGap(SLA_MIN - r.wait)}`}
                      >
                        {narrow ? (overdue ? `−${fmtGap(r.wait - SLA_MIN)}` : fmtGap(SLA_MIN - r.wait)) : overdue ? `прострочено на ${fmtGap(r.wait - SLA_MIN)}` : `через ${fmtGap(SLA_MIN - r.wait)}`}
                      </span>
                    ) : (
                      <span className={cn(overdue ? 'font-semibold text-danger-fg' : 'text-warning-fg')}>{fmtGap(r.wait)}</span>
                    )}
                  </td>
                  <td className={CELL}>
                    {taker ? (
                      <span className="flex min-w-0 items-center gap-1.5" data-taken-by={taker.id}>
                        <Avatar name={taker.name} size={5} tone={taker.id === meId ? 'accent' : 'muted'} />
                        <span className="truncate text-label" title={owner?.responsible ? 'Відповідальний менеджер клієнта' : undefined}>
                          {taker.id === meId ? 'Я' : taker.name}
                          {owner?.responsible && <span className="text-muted-fg"> · відп.</span>}
                        </span>
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

export function MessengersTabLabel({ world, kind = 'Б' }: { world: World; kind?: PoolKind }) {
  const n = waitingCount(world, kind)
  return (
    <>
      <Proposal />
      {n > 0 && <PageTabCount tone="warning">{n}</PageTabCount>}
    </>
  )
}

/* ─── «Пропущені»: повідомлення без відповіді понад SLA ─────────────── */

export function missedMessageRows(world: World, kind: PoolKind = 'Б') {
  return poolRows(world, kind).filter(
    (r) =>
      r.wait != null &&
      r.wait > (managerOwned(world, r) ? ESCALATE_MIN : SLA_MIN) &&
      (kind !== 'A' || minutesBetween(r.ep.waitingSince!, world.now) <= QUIET_MIN),
  )
}

export function MissedMessageRows({ kind = 'Б' }: { kind?: PoolKind }) {
  const { world } = useStore()
  const { openDrawer, go } = useNav()
  return (
    <>
      {missedMessageRows(world, kind).map((r) => {
        const cp = cpById(world, r.t.counterpartyId)
        const taker = staffById(world, ownerOf(world, r.t)?.staffId)
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
                <Badge variant="danger">{managerOwned(world, r) ? 'Менеджер не відповів' : 'Без відповіді'}</Badge>
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
          {last.from === 'client' && <span className="size-1.5 shrink-0 rounded-full bg-danger" title="Клієнт чекає відповіді" aria-label="Клієнт чекає відповіді" />}
          <span className="min-w-0 flex-1 truncate text-label text-fg-2">{last.text}</span>
          {ago != null && ago < 24 * 60 && <span className="shrink-0 text-mono text-muted-fg">{timeOf(last.at)}</span>}
        </>
      ) : (
        <span className="text-label font-medium text-accent-fg group-hover:underline">{t.counterpartyId && cpById(world, t.counterpartyId)?.phone ? 'Написати SMS' : 'Написати'}</span>
      )}
    </button>
  )
}
