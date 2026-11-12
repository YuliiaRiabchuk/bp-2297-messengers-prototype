import { useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { CallDateTime, CELL, ContactCell, FULL_BLEED, GroupHeaderRow, HEAD_CELL } from '@/components/crm'
import { Toolbar } from '@/screens/calls/CallsPage'
import { cpById, staffById } from '@/mock/select'
import { ME_BY_ROLE } from '@/mock/world'
import { dayLabel, dayOf, fmtGap, shortDate, timeOf } from '@/lib/time'
import { useLab } from '@/lab/lab-state'
import { useNav } from '@/state/nav'
import { useStore } from '@/state/store'
import type { MsgEvent, Thread, World } from '@/mock/types'
import { ChannelGlyph } from '../chat/Thread'
import { flatEpisode, SLA_MIN, waitMin } from '../chat/episodes'
import { isClosed, ownerFor, type Flavor } from './SimpleChat'

/**
 * Пул варіанта Г — той самий вигляд, що журнал дзвінків: таблиця, групи по
 * днях, ті самі клітинки. Рядок — розмова з клієнтом; клік — дровер.
 */

interface Row {
  t: Thread
  last: MsgEvent
  wait: number | null
}

const isChat = (t: Thread) => t.events.some((e) => e.kind === 'msg' && e.from === 'client' && e.channel !== 'sms')

export function simpleRows(world: World): Row[] {
  const rows: Row[] = []
  for (const t of world.threads) {
    if (!isChat(t)) continue
    const last = [...t.events].reverse().find((e): e is MsgEvent => e.kind === 'msg')!
    rows.push({ t, last, wait: waitMin(flatEpisode(t, world.now), world.now) })
  }
  // Ті, кому ще не відповіли, — зверху; далі — за часом, нові вище.
  return rows.sort((a, b) => Number(b.wait != null) - Number(a.wait != null) || b.last.at.localeCompare(a.last.at))
}

type Filter = 'all' | 'waiting' | 'mine'

export function SimplePool({ flavor = 'Г' }: { flavor?: Flavor }) {
  const owners = ownerFor(flavor)
  const { world } = useStore()
  const { role } = useLab()
  const { openDrawer, drawer } = useNav()
  const meId = ME_BY_ROLE[role]
  const [filter, setFilter] = useState<Filter>('all')
  const body = useRef<HTMLTableSectionElement>(null)
  const all = useMemo(() => simpleRows(world), [world])
  const rows = all.filter((r) => (filter === 'waiting' ? r.wait != null : filter === 'mine' ? owners(world, r.t)?.staffId === meId : true))
  const waiting = rows.filter((r) => r.wait != null)
  const rest = rows.filter((r) => r.wait == null)
  // Групи — як у журналі: «Чекають відповіді» зверху, далі дні.
  const days: { key: string; label: string; rows: Row[] }[] = []
  for (const r of rest) {
    const d = dayOf(r.last.at)
    const g = days[days.length - 1]
    if (g && g.key === d) g.rows.push(r)
    else days.push({ key: d, label: dayLabel(r.last.at, world.now), rows: [r] })
  }
  const groups = [...(waiting.length ? [{ key: 'waiting', label: 'Чекають відповіді', rows: waiting }] : []), ...days]

  const chip = (k: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(k)}
      aria-pressed={filter === k}
      className={cn('inline-flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-md border px-2.5 text-body font-medium', filter === k ? 'border-fg bg-fg text-primary-fg' : 'border-border bg-card text-fg-2 hover:bg-muted')}
    >
      {label}
    </button>
  )
  const move = (from: HTMLElement, dir: 1 | -1) => {
    const list = [...(body.current?.querySelectorAll<HTMLElement>('[data-pool-row]') ?? [])]
    list[list.indexOf(from) + dir]?.focus()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="messengers">
      <Toolbar placeholder="Пошук">
        <span className="ml-1 flex gap-1">
          {chip('all', 'Усі')}
          {chip('waiting', 'Чекають відповіді')}
          {role !== 'head' && chip('mine', 'Мої')}
        </span>
      </Toolbar>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className={cn('w-full table-fixed border-separate border-spacing-0', drawer ? 'min-w-0' : 'min-w-[860px]', FULL_BLEED)}>
          <colgroup>
            <col style={{ width: 44 }} />
            <col style={{ width: drawer ? undefined : 232 }} />
            {!drawer && <col />}
            <col style={{ width: 150 }} />
            {!drawer && <col style={{ width: 150 }} />}
            <col style={{ width: 96 }} />
          </colgroup>
          <thead>
            <tr>
              <th className={HEAD_CELL}>Тип</th>
              <th className={HEAD_CELL}>Контрагент</th>
              {!drawer && <th className={HEAD_CELL}>Повідомлення</th>}
              <th className={HEAD_CELL}>Статус</th>
              {!drawer && <th className={HEAD_CELL}>Хто взяв</th>}
              <th className={HEAD_CELL}>Дата / час</th>
            </tr>
          </thead>
          <tbody ref={body}>
            {groups.map((g) => (
              <Group key={g.key} label={g.label} count={g.rows.length} cols={drawer ? 4 : 6}>
                {g.rows.map((r) => {
                  const cp = cpById(world, r.t.counterpartyId)
                  const owner = owners(world, r.t)
                  const taker = staffById(world, owner?.staffId)
                  const overdue = r.wait != null && r.wait > SLA_MIN
                  const open = () => openDrawer({ kind: 'thread', id: r.t.id })
                  return (
                    <tr
                      key={r.t.id}
                      tabIndex={0}
                      data-pool-row=""
                      data-thread={r.t.id}
                      data-overdue={overdue ? '' : undefined}
                      onClick={open}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openDrawer({ kind: 'thread', id: r.t.id, intent: 'reply' })
                        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                          e.preventDefault()
                          move(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1)
                        }
                      }}
                      className={cn('cursor-pointer outline-none focus-visible:bg-accent-soft', drawer?.kind === 'thread' && drawer.id === r.t.id ? 'bg-accent-soft' : 'hover:bg-muted/50')}
                    >
                      <td className={CELL}>
                        <ChannelGlyph channel={r.last.channel} className={r.wait != null ? 'text-danger-fg' : undefined} />
                      </td>
                      <td className={cn(CELL, 'relative')}>
                        {cp ? (
                          <ContactCell cp={cp} />
                        ) : (
                          <ContactCell cp={null} phone={r.t.handle?.name ? `${r.t.handle.name} · ${r.t.handle.value}` : r.t.handle?.value} />
                        )}
                      </td>
                      {!drawer && (
                        <td className={CELL}>
                          <span className="line-clamp-2 text-label">
                            {r.last.from !== 'client' && <span className="text-muted-fg">Ви: </span>}
                            {r.last.text}
                          </span>
                        </td>
                      )}
                      <td className={CELL}>
                        {r.wait != null ? (
                          <span className="flex flex-col items-start gap-0.5">
                            <Badge variant={overdue ? 'danger' : 'warning'}>Очікує відповіді</Badge>
                            <span className={cn('text-label tabular-nums', overdue ? 'font-medium text-danger-fg' : 'text-warning-fg')}>{fmtGap(r.wait)}</span>
                          </span>
                        ) : flavor !== 'Г' && isClosed(r.t) ? (
                          <Badge variant="default">Завершено</Badge>
                        ) : (
                          <Badge variant="success">Відповіли</Badge>
                        )}
                      </td>
                      {!drawer && (
                        <td className={CELL}>
                          {taker ? (
                            <span className="truncate text-label" data-taken-by={taker.id}>
                              {taker.id === meId ? 'Ви' : taker.name}
                              {owner?.lastContact && <span className="block text-muted-fg">останній контакт</span>}
                            </span>
                          ) : (
                            <span className="rounded-md border border-dashed border-border-strong px-1.5 py-0.5 text-label text-muted-fg">Не призначено</span>
                          )}
                        </td>
                      )}
                      <td className={CELL}>
                        <CallDateTime date={dayOf(r.last.at) !== dayOf(world.now) ? shortDate(r.last.at) : undefined} time={timeOf(r.last.at)} />
                      </td>
                    </tr>
                  )
                })}
              </Group>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-body text-subtle">
                  Повідомлень немає
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Group({ label, count, cols, children }: { label: string; count: number; cols: number; children: React.ReactNode }) {
  return (
    <>
      <GroupHeaderRow label={label} count={count} colSpan={cols} />
      {children}
    </>
  )
}
