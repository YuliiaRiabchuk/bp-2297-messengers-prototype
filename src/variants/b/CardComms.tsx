import { useMemo, useState } from 'react'
import { MessagesSquare, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionCard } from '@/components/crm'
import { Proposal } from '@/components/proposal'
import { minutesBetween, shortDate, dayOf } from '@/lib/time'
import { useStore } from '@/state/store'
import type { Counterparty, Thread as ThreadT } from '@/mock/types'
import { Thread, StatusBadge } from './Thread'
import { episodeSummary, episodesOf, RESULT_LABEL, type Episode } from './episodes'

/**
 * Віджет «Комунікації» в картці контрагента (варіант Б, пропозиція).
 *
 * Стоїть на всю ширину одразу під «Орендами та резервами»: у лівій колонці
 * спліта (як планував shape) поле відповіді на 1280×720 опинялось нижче
 * першого екрана, а §6 вимагає бачити його без прокрутки.
 *
 * Ліворуч — відповідь керівнику «що було за місяць і чим закінчилось»
 * (сцена 6): де клієнт зараз, воронка звернення → відповідь → резерв →
 * оренда, звернення місяця. Праворуч — той самий `Thread`, що й у дровері.
 */
const MONTH_MIN = 30 * 24 * 60

export function CardComms({ thread }: { cp: Counterparty; thread: ThreadT | null }) {
  const { world } = useStore()
  const [focus, setFocus] = useState<{ index: number; nonce: number } | undefined>()
  const [showAll, setShowAll] = useState(false)
  const episodes = useMemo(() => (thread ? episodesOf(thread, world.now) : []), [thread, world.now])
  const month = episodes.filter((e) => minutesBetween(e.end, world.now) <= MONTH_MIN)
  const cur = episodes[episodes.length - 1]
  const answered = (e: Episode) => e.events.some((x) => (x.kind === 'msg' && x.from === 'staff') || (x.kind === 'call' && x.dir !== 'missed'))
  const funnel = [
    { label: 'Звернень', n: month.length },
    { label: 'З відповіддю', n: month.filter(answered).length },
    { label: 'Резерв', n: month.filter((e) => !e.inherited && (e.result === 'reserve' || e.result === 'rent')).length },
    { label: 'Оренда', n: month.filter((e) => !e.inherited && e.result === 'rent').length },
  ]
  const max = Math.max(1, funnel[0].n)
  const listed = (showAll ? episodes : month).slice().reverse()
  const next = thread?.summary?.next ?? (cur ? episodeSummary(cur, cur.index === 0 ? thread?.summary : undefined).next : null)

  return (
    <SectionCard icon={<MessagesSquare />} title="Комунікації" count={episodes.length || undefined} headExtra={<Proposal />} data-testid="card-comms">
      {!thread ? (
        <div className="px-3.5 py-8 text-center text-body text-subtle" data-empty-chat="">
          Клієнт нам не писав і не дзвонив.
        </div>
      ) : (
        <div className="grid h-[min(560px,calc(100vh-220px))] min-h-[400px] grid-cols-[272px_1fr]">
          <aside className="flex min-h-0 flex-col overflow-y-auto border-r border-border/60">
            <div className="border-b border-border/60 px-3.5 py-3" data-answer-month="">
              {cur && (
                <>
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="text-mono font-semibold uppercase tracking-wider text-muted-fg">Зараз</span>
                    <StatusBadge ep={cur} now={world.now} />
                  </div>
                  {next && <p className="text-body font-medium text-fg">{next}</p>}
                  {thread.summary && episodes.length > 1 && (
                    <p className="mt-1 flex gap-1 text-label text-fg-2">
                      <Sparkles className="mt-0.5 size-3 shrink-0 text-violet-fg" aria-hidden />
                      {thread.summary.agreed}
                    </p>
                  )}
                </>
              )}
              <div className="mb-1.5 mt-3 text-mono font-semibold uppercase tracking-wider text-muted-fg">За 30 днів</div>
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
            </div>
            <ul className="flex flex-col py-1" aria-label="Звернення">
              {listed.map((ep) => (
                <li key={ep.index}>
                  <button
                    type="button"
                    onClick={() => setFocus({ index: ep.index, nonce: Date.now() })}
                    className={cn('flex w-full flex-col gap-0.5 px-3.5 py-1.5 text-left hover:bg-muted/60', focus?.index === ep.index && 'bg-muted')}
                  >
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-label tabular-nums text-fg-2">
                        {shortDate(ep.start)}
                        {dayOf(ep.start) !== dayOf(ep.end) ? `–${shortDate(ep.end)}` : ''}
                      </span>
                      {ep.occasion && <span className="text-label tabular-nums text-muted-fg">{ep.occasion.code}</span>}
                      <span className={cn('ml-auto shrink-0 text-label', ep.status !== 'closed' ? 'text-warning-fg' : ep.result === 'none' ? 'text-danger-fg' : 'text-success-fg')}>
                        {ep.status !== 'closed' ? 'відкрите' : RESULT_LABEL[ep.result ?? 'none']}
                      </span>
                    </span>
                    <span className="line-clamp-1 text-label text-muted-fg">{episodeSummary(ep).asked}</span>
                  </button>
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
          </aside>
          <div className="min-h-0 min-w-0">
            <Thread threadId={thread.id} host="card" focusEpisode={focus} />
          </div>
        </div>
      )}
    </SectionCard>
  )
}
