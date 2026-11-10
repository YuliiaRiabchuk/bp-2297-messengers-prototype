import type { ReactNode } from 'react'
import { Bot, ListFilter, Phone, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Avatar,
  CallDateTime,
  CallDirectionIcon,
  CELL,
  ContactCell,
  FULL_BLEED,
  GroupHeaderRow,
  HEAD_CELL,
  PageTab,
  PageTabCount,
  PageTabStrip,
} from '@/components/crm'
import { callRows, cpById, staffById, type CallRow } from '@/mock/select'
import { ME_BY_ROLE } from '@/mock/world'
import { dayLabel, dayOf, fmtDuration, minutesBetween, shortDate, timeOf } from '@/lib/time'
import { useStore } from '@/state/store'
import { useNav, type CallsTab } from '@/state/nav'
import { useLab } from '@/lab/lab-state'
import type { CallbackTask, World } from '@/mock/types'

/**
 * «Дзвінки» за `routes/_authed.calls.tsx`: п'ять вкладок проду в тому ж
 * порядку — «Мої дзвінки», «Усі», «Пропущені», «Оператори», «ШІ-оператор».
 * Колонки — `features/calls/registry/calls-columns.tsx` (вид «all» і
 * «missed»), підмножина, що влазить у 1280 px.
 *
 * Варіанти додають своє через `ext`: шосту вкладку, колонку в «Усіх»,
 * мітку в клітинці контрагента, рядки в «Пропущених». Варіант 0 не додає
 * нічого.
 */
export interface CallsExt {
  extraTab?: { key: 'messengers'; label: string; count?: ReactNode; render: () => ReactNode }
  /** Додаткова колонка журналу «Усі» (BP-2301). */
  allColumn?: { label: string; width: number; cell: (r: CallRow) => ReactNode }
  /** Мітка біля контрагента в рядку журналу (BP-2300). */
  contactExtra?: (r: CallRow) => ReactNode
  /** Додаткові рядки «Пропущених» (повідомлення без відповіді). */
  missedExtra?: () => ReactNode
  missedExtraCount?: number
}

export function CallsPage({ ext = {} }: { ext?: CallsExt }) {
  const { route, go } = useNav()
  const { world } = useStore()
  const tab = route.screen === 'calls' ? route.tab : 'my-calls'
  const setTab = (t: CallsTab) => go({ screen: 'calls', tab: t })
  const missedOpen = world.tasks.filter((t) => t.status !== 'done' && t.source === 'Пропущений дзвінок').length + (ext.missedExtraCount ?? 0)
  const onCall = 1
  const operators = world.staff.filter((s) => s.role === 'operator').length

  return (
    <div className="flex h-full min-w-0 flex-col">
      <PageTabStrip>
        <PageTab active={tab === 'my-calls'} onClick={() => setTab('my-calls')} testId="calls-tab-my-calls">
          Мої дзвінки
        </PageTab>
        <PageTab active={tab === 'all'} onClick={() => setTab('all')} testId="calls-tab-all">
          Усі
        </PageTab>
        <PageTab active={tab === 'missed'} onClick={() => setTab('missed')} testId="calls-tab-missed">
          Пропущені
          {missedOpen > 0 && <PageTabCount tone="warning">{missedOpen}</PageTabCount>}
        </PageTab>
        <PageTab active={tab === 'operators'} onClick={() => setTab('operators')} testId="calls-tab-operators">
          <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" aria-hidden />
          Оператори
          <span className="rounded-full bg-accent-soft px-1.5 py-0 text-mono font-semibold tabular-nums text-accent-fg">
            {onCall}/{operators}
          </span>
        </PageTab>
        <PageTab active={tab === 'ai'} onClick={() => setTab('ai')} testId="calls-tab-ai">
          ШІ-оператор
        </PageTab>
        {ext.extraTab && (
          <PageTab active={tab === ext.extraTab.key} onClick={() => setTab(ext.extraTab!.key)} testId="calls-tab-messengers">
            {ext.extraTab.label}
            {ext.extraTab.count}
          </PageTab>
        )}
      </PageTabStrip>

      {tab === 'messengers' && ext.extraTab ? (
        ext.extraTab.render()
      ) : (
        <>
          <Toolbar />
          <div className="min-h-0 flex-1 overflow-auto" data-testid="calls-scroll">
            {tab === 'my-calls' && <Journal world={world} mine ext={ext} />}
            {tab === 'all' && <Journal world={world} ext={ext} />}
            {tab === 'missed' && <Missed world={world} ext={ext} />}
            {tab === 'operators' && <Operators world={world} />}
            {tab === 'ai' && <AiSessions world={world} />}
          </div>
        </>
      )}
    </div>
  )
}

export function Toolbar({ placeholder = 'Пошук', children }: { placeholder?: string; children?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2 px-4 py-3">
      <label className="relative flex h-[30px] w-64 items-center">
        <Search className="pointer-events-none absolute left-2.5 size-3.5 text-muted-fg" aria-hidden />
        <input
          type="search"
          placeholder={placeholder}
          className="h-full w-full rounded-md border border-border bg-card pl-8 pr-2 text-body text-fg placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
        />
      </label>
      <button
        type="button"
        className="inline-flex h-[30px] items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-body font-medium text-fg-2 hover:bg-muted"
      >
        <ListFilter className="size-3.5" aria-hidden />
        Фільтри
      </button>
      {children}
    </div>
  )
}

/* ─── «Мої дзвінки» / «Усі» ────────────────────────────────────────── */

function groupByDay<T>(rows: T[], at: (r: T) => string) {
  const out: { day: string; rows: T[] }[] = []
  for (const r of rows) {
    const d = dayOf(at(r))
    const last = out[out.length - 1]
    if (last && last.day === d) last.rows.push(r)
    else out.push({ day: d, rows: [r] })
  }
  return out
}

function Journal({ world, mine, ext }: { world: World; mine?: boolean; ext: CallsExt }) {
  const { go, openDrawer, drawer } = useNav()
  const { role } = useLab()
  const meId = ME_BY_ROLE[role]
  // Журнал вантажить порціями (25 рядків, далі lazy) — тут останні 40.
  const rows = callRows(world)
    .filter((r) => !mine || r.call.operatorId === meId)
    .slice(0, 40)
  const groups = groupByDay(rows, (r) => r.call.at)
  const cols = 7 + (ext.allColumn && !mine ? 1 : 0)

  if (!rows.length) return <p className="px-5 py-10 text-center text-body text-subtle">Дзвінків немає</p>

  return (
    <table className={cn('w-full min-w-[990px] table-fixed border-separate border-spacing-0', FULL_BLEED)} data-testid="journal">
      <colgroup>
        <col style={{ width: 44 }} />
        <col style={{ width: ext.allColumn && !mine ? 204 : 232 }} />
        <col style={{ width: ext.allColumn && !mine ? 162 : 168 }} />
        <col style={{ width: 92 }} />
        <col style={{ width: ext.allColumn && !mine ? 136 : 150 }} />
        {ext.allColumn && !mine && <col style={{ width: ext.allColumn.width }} />}
        <col />
        <col style={{ width: ext.allColumn && !mine ? 104 : 132 }} />
      </colgroup>
      <thead>
        <tr>
          <th className={HEAD_CELL}>Тип</th>
          <th className={HEAD_CELL}>Контрагент</th>
          <th className={cn(HEAD_CELL, 'text-right')}>Розмова / Очікування</th>
          <th className={HEAD_CELL}>Дата / час</th>
          <th className={HEAD_CELL}>Статус / Ціль</th>
          {ext.allColumn && !mine && <th className={HEAD_CELL}>{ext.allColumn.label}</th>}
          <th className={HEAD_CELL}>Суть дзвінка</th>
          <th className={HEAD_CELL}>Співробітник</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <GroupRows key={g.day} label={dayLabel(g.day, world.now)} count={g.rows.length} cols={cols}>
            {g.rows.map((r) => {
              const op = staffById(world, r.call.operatorId)
              const active = drawer?.kind === 'call' && drawer.id === r.call.id
              return (
                <tr
                  key={r.call.id}
                  onClick={() => openDrawer({ kind: 'call', id: r.call.id })}
                  className={cn('cursor-pointer', active ? 'bg-accent-soft' : 'hover:bg-muted/50')}
                  data-call={r.call.id}
                  data-call-time={timeOf(r.call.at)}
                >
                  <td className={CELL}>
                    <CallDirectionIcon dir={r.call.dir} />
                  </td>
                  <td className={cn(CELL, 'relative')}>
                    <ContactCell
                      cp={r.counterparty}
                      phone={r.counterparty?.phone}
                      onOpen={() => r.counterparty && go({ screen: 'cp', id: r.counterparty.id })}
                      extra={ext.contactExtra?.(r)}
                    />
                  </td>
                  <td className={cn(CELL, 'text-right tabular-nums')}>
                    {r.call.dir === 'missed' ? '—' : fmtDuration(r.call.talkSec)}
                    <span className="block text-label text-muted-fg">{fmtDuration(r.call.waitSec)}</span>
                  </td>
                  <td className={CELL}>
                    <CallDateTime time={timeOf(r.call.at)} />
                  </td>
                  <td className={CELL}>
                    <StatusPurpose r={r} world={world} />
                  </td>
                  {ext.allColumn && !mine && <td className={CELL}>{ext.allColumn.cell(r)}</td>}
                  <td className={cn(CELL, 'text-label')}>
                    <span className="line-clamp-2">{r.call.summary ?? <span className="text-subtle">—</span>}</span>
                  </td>
                  <td className={CELL}>
                    {op ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Avatar name={op.name} size={5} />
                        <span className="truncate text-label">{op.name.split(' ')[0]}</span>
                      </span>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </GroupRows>
        ))}
      </tbody>
    </table>
  )
}

function GroupRows({ label, count, cols, children }: { label: string; count: number; cols: number; children: ReactNode }) {
  return (
    <>
      <GroupHeaderRow label={label} count={count} colSpan={cols} />
      {children}
    </>
  )
}

function StatusPurpose({ r, world }: { r: CallRow; world: World }) {
  if (r.call.created)
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-label font-medium text-accent-fg">
        {r.call.created.kind === 'reserve' ? 'Резерв' : 'Оренда'} {r.call.created.code}
      </span>
    )
  if (r.call.dir === 'missed') {
    const task = world.tasks.find((t) => t.counterpartyId === r.thread.counterpartyId && t.source === 'Пропущений дзвінок')
    if (task) return <Badge variant={task.status === 'done' ? 'success' : 'warning'}>{task.status === 'done' ? 'Оброблено' : 'Очікує обробки'}</Badge>
    return <span className="text-subtle">—</span>
  }
  return r.call.purpose ? <span className="text-body text-fg-2">{r.call.purpose}</span> : <span className="text-subtle">—</span>
}

/* ─── «Пропущені» ──────────────────────────────────────────────────── */

function Missed({ world, ext }: { world: World; ext: CallsExt }) {
  const { go, openDrawer } = useNav()
  const tasks = world.tasks.filter((t) => t.source === 'Пропущений дзвінок' && t.status !== 'done')
  return (
    <table className={cn('w-full min-w-[900px] table-fixed border-separate border-spacing-0', FULL_BLEED)} data-testid="missed">
      <colgroup>
        <col style={{ width: 44 }} />
        <col style={{ width: 232 }} />
        <col style={{ width: 140 }} />
        <col style={{ width: 150 }} />
        <col style={{ width: 120 }} />
        <col />
        <col style={{ width: 96 }} />
      </colgroup>
      <thead>
        <tr>
          <th className={HEAD_CELL}>Тип</th>
          <th className={HEAD_CELL}>Контрагент</th>
          <th className={HEAD_CELL}>Статус</th>
          <th className={HEAD_CELL}>Хто взяв</th>
          <th className={HEAD_CELL}>Спроби додзвонитися</th>
          <th className={HEAD_CELL}>Дедлайн</th>
          <th className={HEAD_CELL}>Дата / час</th>
        </tr>
      </thead>
      <tbody>
        {ext.missedExtra?.()}
        {tasks.map((t) => (
          <MissedRow key={t.id} t={t} world={world} onOpen={() => openDrawer({ kind: 'task', id: t.id })} onCp={(id) => go({ screen: 'cp', id })} />
        ))}
        {!tasks.length && !ext.missedExtraCount && (
          <tr>
            <td colSpan={7} className="px-5 py-10 text-center text-body text-subtle">
              Пропущених немає
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}

function MissedRow({ t, world, onOpen, onCp }: { t: CallbackTask; world: World; onOpen: () => void; onCp: (id: string) => void }) {
  const cp = cpById(world, t.counterpartyId)
  const assignee = staffById(world, t.assigneeId)
  const overdueMin = minutesBetween(t.deadlineAt, world.now)
  return (
    <tr onClick={onOpen} className="cursor-pointer hover:bg-muted/50">
      <td className={CELL}>
        <CallDirectionIcon dir="missed" />
      </td>
      <td className={cn(CELL, 'relative')}>
        <ContactCell cp={cp} phone={t.phone} emphasizePhone onOpen={() => cp && onCp(cp.id)} />
      </td>
      <td className={CELL}>
        <Badge variant="warning">Очікує обробки</Badge>
      </td>
      <td className={CELL}>
        {assignee ? (
          <span className="text-label">{assignee.name}</span>
        ) : (
          <span className="rounded-md border border-dashed border-border-strong px-1.5 py-0.5 text-label text-muted-fg">Не призначено</span>
        )}
      </td>
      <td className={cn(CELL, 'tabular-nums')}>{t.attempts}</td>
      <td className={CELL}>
        <span className={cn('whitespace-nowrap', overdueMin > 0 ? 'font-medium text-danger-fg' : 'text-warning-fg')}>
          {overdueMin > 0 ? `прострочено на ${overdueMin} хв` : `через ${-overdueMin} хв`}
        </span>
      </td>
      <td className={CELL}>
        <CallDateTime date={shortDate(t.createdAt)} time={timeOf(t.createdAt)} />
      </td>
    </tr>
  )
}

/* ─── «Оператори» ──────────────────────────────────────────────────── */

function Operators({ world }: { world: World }) {
  const ops = world.staff.filter((s) => s.role === 'operator')
  return (
    <ul className="divide-y divide-border border-y border-border">
      {ops.map((o, i) => (
        <li key={o.id} className="flex items-center gap-3 px-5 py-2.5">
          <Avatar name={o.name} size={7} />
          <span className="flex min-w-0 flex-col">
            <span className="text-body font-medium text-fg">{o.name}</span>
            <span className="text-label text-muted-fg">{o.team}</span>
          </span>
          {i === 0 ? (
            <Badge variant="accent" className="ml-auto">
              <Phone className="size-3" aria-hidden /> у дзвінку
            </Badge>
          ) : (
            <Badge variant="success" className="ml-auto">
              Онлайн
            </Badge>
          )}
        </li>
      ))}
    </ul>
  )
}

/* ─── «ШІ-оператор» ────────────────────────────────────────────────── */

function AiSessions({ world }: { world: World }) {
  const { go } = useNav()
  return (
    <table className={cn('w-full min-w-[820px] table-fixed border-separate border-spacing-0', FULL_BLEED)}>
      <colgroup>
        <col style={{ width: 120 }} />
        <col style={{ width: 96 }} />
        <col style={{ width: 232 }} />
        <col />
        <col style={{ width: 150 }} />
        <col style={{ width: 150 }} />
      </colgroup>
      <thead>
        <tr>
          <th className={HEAD_CELL}>Дата / час</th>
          <th className={cn(HEAD_CELL, 'text-right')}>Тривалість</th>
          <th className={HEAD_CELL}>Контрагент</th>
          <th className={HEAD_CELL}>Обладнання</th>
          <th className={HEAD_CELL}>Підсумок</th>
          <th className={HEAD_CELL}>Співробітник</th>
        </tr>
      </thead>
      <tbody>
        <GroupHeaderRow label="Сьогодні" count={world.aiSessions.length} colSpan={6} />
        {world.aiSessions.map((s) => {
          const cp = cpById(world, s.counterpartyId)
          return (
            <tr key={s.id} className="hover:bg-muted/50">
              <td className={CELL}>
                <CallDateTime time={timeOf(s.at)} />
              </td>
              <td className={cn(CELL, 'text-right tabular-nums')}>{fmtDuration(s.durationSec)}</td>
              <td className={cn(CELL, 'relative')}>
                <ContactCell cp={cp} phone={s.phone} onOpen={() => cp && go({ screen: 'cp', id: cp.id })} />
              </td>
              <td className={CELL}>{s.equipment}</td>
              <td className={CELL}>
                <Badge variant={s.outcome === 'Заявка' ? 'success' : 'warning'}>{s.outcome}</Badge>
              </td>
              <td className={CELL}>
                <span className="flex items-center gap-1.5 text-label">
                  <Avatar tone="violet" size={5}>
                    <Bot />
                  </Avatar>
                  Софія
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
