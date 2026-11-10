import { useMemo, useState, type ReactNode } from 'react'
import { Clock, MessagesSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionCard } from '@/components/crm'
import { Proposal } from '@/components/proposal'
import { minutesBetween, shortDate, dayOf } from '@/lib/time'
import type { CardLayout } from '@/lab/lab-state'
import { useStore } from '@/state/store'
import type { Counterparty, Thread as ThreadT, World } from '@/mock/types'
import { Thread, StatusBadge } from './Thread'
import { episodeSummary, episodesOf, RESULT_LABEL, type Episode } from './episodes'

/**
 * Листування в картці контрагента (пропозиція). Що всередині — вирішує
 * варіант, де стоїть — положення з «Кадрів» (Q3):
 *  - А: тільки тред (зведення за період — у самому треді);
 *  - Б: ліворуч «Зараз», воронка за 30 днів і звернення, праворуч тред;
 *  - В: ліворуч архів звернень, згрупований за приводом (як у Севи),
 *       праворуч тред для читання — відповідь у вікні звернення.
 */
export type CommsKind = 'A' | 'Б' | 'В'

const MONTH_MIN = 30 * 24 * 60

export function CardComms({ kind, layout, thread }: { kind: CommsKind; layout: CardLayout; cp: Counterparty; thread: ThreadT | null }) {
  const { world } = useStore()
  const [focus, setFocus] = useState<{ index: number; nonce: number } | undefined>()
  const episodes = useMemo(() => (thread ? episodesOf(thread, world.now) : []), [thread, world.now])
  const onPick = (index: number) => setFocus({ index, nonce: Date.now() })

  const aside: ReactNode =
    !thread || kind === 'A' ? null : kind === 'Б' ? (
      <MonthAside world={world} thread={thread} episodes={episodes} focus={focus?.index} onPick={onPick} />
    ) : (
      <ArchiveAside world={world} thread={thread} episodes={episodes} focus={focus?.index} onPick={onPick} />
    )
  const threadNode = thread && (
    <Thread threadId={thread.id} host="card" focusEpisode={focus} mode={kind === 'A' ? 'flat' : 'episodes'} readOnly={kind === 'В'} />
  )

  const body = !thread ? (
    <div className="px-3.5 py-8 text-center text-body text-subtle" data-empty-chat="">
      Клієнт нам не писав і не дзвонив.
    </div>
  ) : layout === 'history' ? (
    <div className="flex flex-col">
      {aside && <div className="max-h-[220px] overflow-y-auto border-b border-border/60">{aside}</div>}
      <div className="h-[28rem]">{threadNode}</div>
    </div>
  ) : (
    <div
      className={cn(
        'grid',
        aside ? 'grid-cols-[272px_1fr]' : 'grid-cols-1',
        layout === 'tabs' ? 'h-full min-h-0' : 'h-[min(560px,calc(100vh-220px))] min-h-[400px]',
      )}
    >
      {aside && <aside className="flex min-h-0 flex-col overflow-y-auto border-r border-border/60">{aside}</aside>}
      <div className="min-h-0 min-w-0">{threadNode}</div>
    </div>
  )

  return (
    <SectionCard
      icon={layout === 'history' ? <Clock /> : <MessagesSquare />}
      title={layout === 'history' ? 'Історія' : 'Комунікації'}
      count={kind !== 'A' && episodes.length ? episodes.length : undefined}
      headExtra={<>{kind !== 'A' && episodes.length > 0 && <span className="text-label text-muted-fg">звернень</span>}<Proposal /></>}
      data-testid="card-comms"
      className={layout === 'tabs' ? 'h-full' : undefined}
      bodyClassName={layout === 'tabs' ? 'flex-1' : undefined}
    >
      {body}
    </SectionCard>
  )
}

/* ─── Б: «Зараз», воронка, звернення місяця ─────────────────────────── */

const answered = (e: Episode) => e.events.some((x) => (x.kind === 'msg' && x.from === 'staff') || (x.kind === 'call' && x.dir !== 'missed'))

function Funnel({ month }: { month: Episode[] }) {
  const funnel = [
    { label: 'Звернень', n: month.length },
    { label: 'З відповіддю', n: month.filter(answered).length },
    { label: 'Резерв', n: month.filter((e) => !e.inherited && (e.result === 'reserve' || e.result === 'rent')).length },
    { label: 'Оренда', n: month.filter((e) => !e.inherited && e.result === 'rent').length },
  ]
  const max = Math.max(1, funnel[0].n)
  return (
    <ol className="flex flex-col gap-1">
      {funnel.map((f) => (
        <li key={f.label} className="grid grid-cols-[92px_1fr_24px] items-center gap-2">
          <span className="text-label text-fg-2">{f.label}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-fg-2" style={{ width: `${(f.n / max) * 100}%` }} />
          </span>
          <span className="text-right text-body font-semibold tabular-nums text-fg">{f.n}</span>
        </li>
      ))}
    </ol>
  )
}

function EpisodeLink({ ep, active, onPick }: { ep: Episode; active: boolean; onPick: (i: number) => void }) {
  return (
    <button type="button" onClick={() => onPick(ep.index)} className={cn('flex w-full flex-col gap-0.5 px-3.5 py-1.5 text-left hover:bg-muted/60', active && 'bg-muted')}>
      <span className="flex items-baseline gap-1.5">
        <span className="text-label tabular-nums text-fg-2">
          {shortDate(ep.start)}
          {dayOf(ep.start) !== dayOf(ep.end) ? `–${shortDate(ep.end)}` : ''}
        </span>
        {ep.occasion && <span className="text-label tabular-nums text-muted-fg">{ep.occasion.code}</span>}
        <span className={cn('ml-auto shrink-0 text-label', ep.status !== 'closed' ? 'text-warning-fg' : ep.inherited ? 'text-muted-fg' : ep.result === 'none' ? 'text-danger-fg' : 'text-success-fg')}>
          {/* Успадковане звернення — не нова оренда; воронка його не рахує, тож і тут не «Оренда». */}
          {ep.status !== 'closed' ? 'відкрите' : ep.inherited ? 'у межах оренди' : RESULT_LABEL[ep.result ?? 'none']}
        </span>
      </span>
      <span className="line-clamp-1 text-label text-muted-fg">{episodeSummary(ep).asked}</span>
    </button>
  )
}

function MonthAside({ world, thread, episodes, focus, onPick }: { world: World; thread: ThreadT; episodes: Episode[]; focus?: number; onPick: (i: number) => void }) {
  const [showAll, setShowAll] = useState(false)
  const month = episodes.filter((e) => minutesBetween(e.end, world.now) <= MONTH_MIN)
  const cur = episodes[episodes.length - 1]
  const listed = (showAll ? episodes : month).slice().reverse()
  const next = thread.summary?.next ?? (cur ? episodeSummary(cur, cur.index === 0 ? thread.summary : undefined, world.now).next : null)
  return (
    <>
      <div className="border-b border-border/60 px-3.5 py-3" data-answer-month="">
        {cur && (
          <>
            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-mono font-semibold uppercase tracking-wider text-muted-fg">Зараз</span>
              <StatusBadge ep={cur} now={world.now} />
            </div>
            {next && <p className="text-body font-medium text-fg">{next}</p>}
          </>
        )}
        <div className="mb-1.5 mt-3 text-mono font-semibold uppercase tracking-wider text-muted-fg">За 30 днів</div>
        <Funnel month={month} />
      </div>
      <ul className="flex flex-col py-1" aria-label="Звернення">
        {listed.map((ep) => (
          <li key={ep.index}>
            <EpisodeLink ep={ep} active={focus === ep.index} onPick={onPick} />
          </li>
        ))}
        {!showAll && episodes.length > month.length && (
          <li>
            <button type="button" onClick={() => setShowAll(true)} className="w-full px-3.5 py-1.5 text-left text-label font-medium text-accent-fg hover:bg-muted/60">
              Показати всі {episodes.length} — з {shortDate(episodes[0].start)}.{episodes[0].start.slice(2, 4)}
            </button>
          </li>
        )}
      </ul>
    </>
  )
}

/* ─── В: архів звернень за приводом ─────────────────────────────────── */

function ArchiveAside({ world, thread, episodes, focus, onPick }: { world: World; thread: ThreadT; episodes: Episode[]; focus?: number; onPick: (i: number) => void }) {
  const month = episodes.filter((e) => minutesBetween(e.end, world.now) <= MONTH_MIN)
  const cur = episodes[episodes.length - 1]
  const recent = episodes.slice().reverse().slice(0, 40)
  const groups = [
    { key: 'rent', label: 'Оренди', items: recent.filter((e) => e.occasion?.kind === 'rent') },
    { key: 'reserve', label: 'Резерви', items: recent.filter((e) => e.occasion?.kind === 'reserve') },
    { key: 'none', label: 'Без приводу', items: recent.filter((e) => !e.occasion) },
  ].filter((g) => g.items.length)
  return (
    <>
      <div className="border-b border-border/60 px-3.5 py-3" data-answer-month="">
        {cur && (
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-mono font-semibold uppercase tracking-wider text-muted-fg">Зараз</span>
            <StatusBadge ep={cur} now={world.now} />
          </div>
        )}
        {(thread.summary?.next ?? (cur && episodeSummary(cur, cur.index === 0 ? thread.summary : undefined, world.now).next)) && (
          <p className="mb-2 text-body font-medium text-fg">{thread.summary?.next ?? episodeSummary(cur!, cur!.index === 0 ? thread.summary : undefined, world.now).next}</p>
        )}
        <div className="mb-1.5 text-mono font-semibold uppercase tracking-wider text-muted-fg">За 30 днів</div>
        <Funnel month={month} />
      </div>
      {groups.map((g) => (
        <div key={g.key} className="pb-1">
          <div className="sticky top-0 z-[1] bg-card px-3.5 pb-1 pt-2 text-label text-muted-fg">
            {g.label} <span className="tabular-nums text-subtle">{g.items.length}</span>
          </div>
          {g.items.map((ep) => (
            <EpisodeLink key={ep.index} ep={ep} active={focus === ep.index} onPick={onPick} />
          ))}
        </div>
      ))}
      {episodes.length > recent.length && <p className="px-3.5 py-2 text-label text-muted-fg">Ще {episodes.length - recent.length} старших — пошуком</p>}
    </>
  )
}
