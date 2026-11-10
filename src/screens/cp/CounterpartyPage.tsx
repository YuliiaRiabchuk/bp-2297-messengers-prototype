import { useState, type ReactNode } from 'react'
import { CalendarClock, ChevronLeft, Clock, FileText, MessageSquare, Package, Send, Tag, Wrench, ListChecks, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { CallDirectionIcon, CounterpartyAvatar, SectionCard, WidgetEmpty } from '@/components/crm'
import { cpById, staffById, threadOfCp } from '@/mock/select'
import { dayLabel, dayOf, fmtDuration, shortDate, timeOf } from '@/lib/time'
import { useNav } from '@/state/nav'
import { useStore } from '@/state/store'
import type { Counterparty, Occasion, Thread, ThreadEvent, World } from '@/mock/types'
import { useLab, type CardLayout } from '@/lab/lab-state'
import { Proposal } from '@/components/proposal'

/**
 * Картка контрагента за `features/counterparties/detail/widgets/layout.ts`
 * (`DEFAULT_PROFILE_LAYOUT`): без вкладок, віджети на тлі canvas —
 * «Оренди та резерви», «Інтереси», «Історія обладнання», «Операції», потім
 * спліт 1.5fr/1fr: «Історія» ліворуч, «Задачі» і «Коментарі» праворуч.
 *
 * Слоти для варіантів: `fullAfterOps` (повна ширина одразу після «Оренд
 * та резервів» — так ставить свій віджет Сева), `leftTop` (над «Історією» в спліті — так
 * ставлять «Комунікації» нові варіанти), `historyRows` (додаткові рядки
 * «Історії»).
 */
export interface CardSlots {
  /**
   * Листування нових варіантів. Картка сама ставить його за положенням з
   * «Кадрів» (Q3): віджет під «Орендами та резервами», на місці «Історії» або
   * окремою вкладкою.
   */
  comms?: (cp: Counterparty, t: Thread | null, layout: CardLayout) => ReactNode
  fullAfterOps?: (cp: Counterparty, t: Thread | null) => ReactNode
  leftTop?: (cp: Counterparty, t: Thread | null) => ReactNode
  /** Сховати прод-«Історію» (варіант заміняє її своєю). */
  hideHistory?: boolean
  historyExtra?: (t: Thread) => HistoryLine[]
}

export function CounterpartyPage({ id, slots = {} }: { id: string; slots?: CardSlots }) {
  const { world } = useStore()
  const { go } = useNav()
  const { card: layout } = useLab()
  const [tab, setTab] = useState<'card' | 'comms'>('card')
  const cp = cpById(world, id)
  if (!cp) return <WidgetEmpty>Контрагента не знайдено.</WidgetEmpty>
  const thread = threadOfCp(world, cp.id)
  const comms = slots.comms
  const tabs = !!comms && layout === 'tabs'

  return (
    <div className="flex h-full flex-col" data-testid="cp-page">
      <div className="flex shrink-0 items-center gap-3 border-b border-border/40 px-4 py-2">
        <button
          type="button"
          onClick={() => go({ screen: 'calls', tab: 'all' })}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-body font-medium text-fg-2 hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
          Назад
        </button>
        <div className="h-4 w-px bg-border" />
        <nav className="flex min-w-0 items-center gap-1.5 text-body text-muted-fg">
          <span>Контрагенти</span>
          <span className="text-subtle">/</span>
          <span className="truncate font-medium text-fg-2">{cp.name}</span>
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <span className="inline-flex h-7 items-center gap-2 rounded-full border border-border/40 bg-card pl-1.5 pr-2 text-fg-2">
            <CounterpartyAvatar cp={cp} />
            <span className="max-w-[180px] truncate text-body font-semibold">{cp.name}</span>
            <kbd className="rounded border border-border px-1 text-mono text-muted-fg">D</kbd>
          </span>
        </div>
      </div>

      {tabs && (
        <div className="flex shrink-0 items-end gap-5 border-b border-border px-4" role="tablist" aria-label="Розділи картки">
          {(['card', 'comms'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              data-walk-month={k === 'comms' ? '' : undefined}
              className={cn(
                '-mb-px inline-flex items-center gap-1.5 border-b-[3px] px-0.5 py-2 text-body font-medium',
                tab === k ? 'border-fg text-fg' : 'border-transparent text-muted-fg hover:text-fg',
              )}
            >
              {k === 'card' ? 'Картка' : 'Комунікації'}
              {k === 'comms' && <Proposal />}
            </button>
          ))}
        </div>
      )}
      {tabs && tab === 'comms' ? (
        <div className="min-h-0 flex-1 bg-canvas p-4" data-testid="card-scroll">
          {comms!(cp, thread, 'tabs')}
        </div>
      ) : (
      <div className="min-h-0 flex-1 overflow-auto bg-canvas p-4" data-testid="card-scroll">
        <div className="flex flex-col gap-3.5">
          <OpsWidget world={world} cp={cp} thread={thread} />
          {slots.fullAfterOps?.(cp, thread)}
          {comms && layout === 'widget' && comms(cp, thread, 'widget')}
          <InterestsWidget cp={cp} />
          <EquipmentWidget thread={thread} />
          <LedgerWidget cp={cp} />
          <div className="grid grid-cols-[1.5fr_1fr] gap-3.5">
            <div className="flex min-w-0 flex-col gap-3.5">
              {slots.leftTop?.(cp, thread)}
              {comms && layout === 'history' ? comms(cp, thread, 'history') : !slots.hideHistory && <HistoryWidget world={world} thread={thread} extra={slots.historyExtra} />}
            </div>
            <div className="flex min-w-0 flex-col gap-3.5">
              <TasksWidget world={world} cp={cp} />
              <SectionCard icon={<MessageSquare />} title="Коментарі" cap="max-h-[28rem]">
                <WidgetEmpty>Поки немає коментарів.</WidgetEmpty>
              </SectionCard>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

/* ─── віджети ─────────────────────────────────────────────────────── */

function occasionsOf(t: Thread | null): (Occasion & { at: string })[] {
  if (!t) return []
  const out: (Occasion & { at: string })[] = []
  for (const e of t.events) {
    const o = e.kind === 'call' ? e.created : e.kind === 'system' ? e.occasion : undefined
    if (o && !out.some((x) => x.code === o.code)) out.push({ ...o, at: e.at })
  }
  return out.reverse()
}

function OpsWidget({ world, cp, thread }: { world: World; cp: Counterparty; thread: Thread | null }) {
  const ops = occasionsOf(thread)
  const manager = staffById(world, cp.managerId)
  return (
    <SectionCard
      icon={<Package />}
      title="Оренди та резерви"
      count={ops.length}
      headExtra={manager && <span className="text-label text-muted-fg">Відповідальний: {manager.name}</span>}
    >
      {ops.length ? (
        <table className="w-full text-body">
          <tbody>
            {ops.map((o) => (
              <tr key={o.code} className="border-b border-border/40 last:border-0">
                <td className="w-28 px-3.5 py-2 font-medium tabular-nums text-fg">{o.code}</td>
                <td className="px-2 py-2">
                  <Badge variant={o.kind === 'rent' ? 'success' : 'accent'}>{o.kind === 'rent' ? 'Оренда' : 'Резерв'}</Badge>
                </td>
                <td className="px-2 py-2 text-fg-2">{o.label}</td>
                <td className="px-3.5 py-2 text-right text-label tabular-nums text-muted-fg">{shortDate(o.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <WidgetEmpty>Оренд і резервів немає</WidgetEmpty>
      )}
    </SectionCard>
  )
}

function InterestsWidget({ cp }: { cp: Counterparty }) {
  const items = cp.kind === 'UL' ? ['Риштування рамні', 'Бетонозмішувач'] : []
  return (
    <SectionCard icon={<Tag />} title="Інтереси">
      {items.length ? (
        <div className="flex flex-wrap gap-1.5 px-3.5 py-2.5">
          {items.map((i) => (
            <Badge key={i} variant="outline">
              {i}
            </Badge>
          ))}
        </div>
      ) : (
        <WidgetEmpty>Інтересів немає</WidgetEmpty>
      )}
    </SectionCard>
  )
}

function EquipmentWidget({ thread }: { thread: Thread | null }) {
  const rents = occasionsOf(thread).filter((o) => o.kind === 'rent')
  return (
    <SectionCard icon={<Wrench />} title="Історія обладнання">
      {rents.length ? (
        <div className="px-3.5 py-2 text-body text-fg-2">{rents.map((r) => r.label).join(' · ')}</div>
      ) : (
        <WidgetEmpty>Клієнт поки нічого не брав</WidgetEmpty>
      )}
    </SectionCard>
  )
}

function LedgerWidget({ cp }: { cp: Counterparty }) {
  return (
    <SectionCard icon={<Wallet />} title="Операції">
      {cp.kind === 'UL' ? (
        <table className="w-full text-body">
          <tbody>
            {[
              ['27.10', 'Рахунок № 1186 · продовження до 17.11', '−41 720'],
              ['20.10', 'Оплата за рахунком № 1171', '+89 400'],
            ].map(([d, t, s]) => (
              <tr key={t} className="border-b border-border/40 last:border-0">
                <td className="w-20 px-3.5 py-2 text-label tabular-nums text-muted-fg">{d}</td>
                <td className="px-2 py-2 text-fg-2">{t}</td>
                <td className="px-3.5 py-2 text-right font-medium tabular-nums text-fg">{s}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <WidgetEmpty>Операцій такого роду не було</WidgetEmpty>
      )}
    </SectionCard>
  )
}

function TasksWidget({ world, cp }: { world: World; cp: Counterparty }) {
  const { openDrawer } = useNav()
  const tasks = world.tasks.filter((t) => t.counterpartyId === cp.id && t.status !== 'done')
  return (
    <SectionCard icon={<ListChecks />} title="Задачі" count={tasks.length || undefined} cap="max-h-[24rem]">
      {tasks.length ? (
        tasks.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => openDrawer({ kind: 'task', id: t.id })}
            className="flex w-full items-center gap-2 border-b border-border/40 px-3.5 py-2 text-left last:border-0 hover:bg-muted/50"
          >
            <span className="text-body font-medium text-fg">{t.title}</span>
            <span className="truncate text-label text-muted-fg">{t.source}</span>
          </button>
        ))
      ) : (
        <WidgetEmpty>Відкритих задач немає</WidgetEmpty>
      )}
    </SectionCard>
  )
}

/* ─── «Історія» (`features/counterparties/registry/InteractionTimeline`) ── */

export interface HistoryLine {
  at: string
  icon: ReactNode
  where: string
  text: ReactNode
  who: string
  onClick?: () => void
  tone?: 'danger'
  key: string
}

const VIA = { sms: 'SMS', 'viber-notify': 'Viber' } as const

/** Прод показує дзвінки, події й вихідні сповіщення (BP-1803). Чатів у ньому немає. */
export function prodHistoryLines(world: World, t: Thread): HistoryLine[] {
  const lines: HistoryLine[] = []
  for (const e of t.events as ThreadEvent[]) {
    if (e.kind === 'call') {
      const op = staffById(world, e.operatorId)
      lines.push({
        key: e.id,
        at: e.at,
        icon: <CallDirectionIcon dir={e.dir} className="size-3.5" />,
        where: `Телефон · ${e.line}`,
        text:
          e.dir === 'missed'
            ? 'Пропущений'
            : `${e.dir === 'in' ? 'Вхідний' : 'Вихідний'} ${fmtDuration(e.talkSec)}${e.summary ? ` · ${e.summary}` : ''}`,
        who: op?.name ?? 'Колл-центр',
        tone: e.dir === 'missed' ? 'danger' : undefined,
      })
    } else if (e.kind === 'msg' && (e.channel === 'sms' || e.channel === 'viber-notify')) {
      const failed = e.delivery === 'failed'
      lines.push({
        key: e.id,
        at: e.at,
        icon: <Send className="size-3.5" />,
        where: VIA[e.channel],
        text: `Повідомлення клієнту (${VIA[e.channel]}) ${failed ? 'не доставлено' : 'доставлено'}: ${e.text}`,
        who: staffById(world, e.staffId)?.name ?? 'Система',
        tone: failed ? 'danger' : undefined,
      })
    } else if (e.kind === 'system' && e.occasion && !/посиланням/.test(e.text)) {
      lines.push({
        key: e.id,
        at: e.at,
        icon: e.occasion.kind === 'rent' ? <FileText className="size-3.5" /> : <CalendarClock className="size-3.5" />,
        where: e.occasion.kind === 'rent' ? 'Оренда' : 'Резерв',
        text: e.text,
        who: 'Система',
      })
    }
  }
  return lines
}

function HistoryWidget({ world, thread, extra }: { world: World; thread: Thread | null; extra?: (t: Thread) => HistoryLine[] }) {
  const [all, setAll] = useState(false)
  if (!thread)
    return (
      <SectionCard icon={<Clock />} title="Історія">
        <WidgetEmpty>Подій ще немає</WidgetEmpty>
      </SectionCard>
    )
  const lines = [...prodHistoryLines(world, thread), ...(extra?.(thread) ?? [])].sort((a, b) => b.at.localeCompare(a.at))
  const shown = all ? lines : lines.slice(0, 30)
  return (
    <SectionCard icon={<Clock />} title="Історія" count={lines.length} cap="max-h-[28rem]" data-testid="history-widget">
      {shown.map((l, i) => {
        const newDay = i === 0 || dayOf(shown[i - 1].at) !== dayOf(l.at)
        return (
          <div key={l.key}>
            {newDay && (
              <div className="border-b border-border/40 bg-muted px-3.5 py-[5px] text-mono font-bold uppercase tracking-wider text-muted-fg">
                {dayLabel(l.at, world.now)}
              </div>
            )}
            <div
              onClick={l.onClick}
              className={cn('group flex items-start gap-3 border-b border-border/40 px-3.5 py-2', l.onClick && 'cursor-pointer hover:bg-muted/50')}
              data-history-line=""
            >
              <span className={cn('mt-0.5 inline-flex text-muted-fg', l.tone === 'danger' && 'text-danger-fg')}>{l.icon}</span>
              <span className="w-[38px] shrink-0 text-label tabular-nums text-muted-fg">{timeOf(l.at)}</span>
              <span className="w-[120px] shrink-0 truncate text-label text-fg-2">{l.where}</span>
              <span className={cn('min-w-0 flex-1 text-body text-fg-2', l.tone === 'danger' && 'text-danger-fg')}>{l.text}</span>
              <span className="shrink-0 text-label text-muted-fg">{l.who}</span>
            </div>
          </div>
        )
      })}
      {!all && lines.length > 30 && (
        <button type="button" onClick={() => setAll(true)} className="w-full px-3.5 py-2 text-left text-label font-medium text-accent-fg hover:bg-muted/50">
          Показати ще {lines.length - 30}
        </button>
      )}
    </SectionCard>
  )
}
