import type { ReactNode } from 'react'
import { ExternalLink, Phone, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CallDirectionIcon, CounterpartyAvatar, DIR_LABEL } from '@/components/crm'
import { cpById, staffById, threadById } from '@/mock/select'
import { fmtDuration, minutesBetween, shortDate, timeOf } from '@/lib/time'
import { useNav } from '@/state/nav'
import { useStore } from '@/state/store'
import type { CallEvent, World } from '@/mock/types'

/**
 * Дровери master-detail: картка дзвінка (`features/calls/detail/CallDrawer`)
 * і задача «Передзвонити» (`features/tasks/detail/TaskDrawer`). Скорочено до
 * того, що треба сценам; рядки — з `uk.po`.
 */

export function DrawerFrame({
  title,
  sub,
  onClose,
  actions,
  children,
  footer,
  testId,
}: {
  title: ReactNode
  sub?: ReactNode
  onClose: () => void
  actions?: ReactNode
  children: ReactNode
  footer?: ReactNode
  testId?: string
}) {
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid={testId}>
      <header className="flex shrink-0 items-start gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-title font-semibold text-fg">{title}</div>
          {sub && <div className="mt-0.5 text-label text-muted-fg">{sub}</div>}
        </div>
        {actions}
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрити"
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-fg hover:bg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && <footer className="shrink-0 border-t border-border px-4 py-3">{footer}</footer>}
    </div>
  )
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 px-4 py-3 text-body">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-fg">{k}</dt>
          <dd className="min-w-0 text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Фіолетовий блок «AI-зведення минулого дзвінка» (`CallTaskAiSummary`). */
export function AiSummaryNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-violet/20 bg-violet-soft px-3 py-2.5">
      <div className="mb-1 flex items-center gap-1.5 text-mono font-semibold uppercase tracking-wider text-violet-fg">
        <Sparkles className="size-3.5" aria-hidden />
        {title}
      </div>
      <div className="text-body text-fg">{children}</div>
    </div>
  )
}

function findCall(world: World, id: string): { call: CallEvent; threadId: string } | null {
  for (const t of world.threads) for (const e of t.events) if (e.kind === 'call' && e.id === id) return { call: e, threadId: t.id }
  return null
}

export function CallDrawer({ id }: { id: string }) {
  const { world } = useStore()
  const { go, openDrawer } = useNav()
  const found = findCall(world, id)
  if (!found) return null
  const { call } = found
  const thread = threadById(world, found.threadId)
  const cp = cpById(world, thread?.counterpartyId)
  const op = staffById(world, call.operatorId)
  return (
    <DrawerFrame
      testId="call-drawer"
      title={
        <span className="flex items-center gap-2">
          <CallDirectionIcon dir={call.dir} />
          {DIR_LABEL[call.dir]} · {timeOf(call.at)}
        </span>
      }
      sub={shortDate(call.at)}
      onClose={() => openDrawer(null)}
    >
      {cp && (
        <button
          type="button"
          onClick={() => go({ screen: 'cp', id: cp.id })}
          className="flex w-full items-center gap-2.5 border-b border-border px-4 py-3 text-left hover:bg-muted/50"
        >
          <CounterpartyAvatar cp={cp} size={8} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body font-semibold text-fg">{cp.name}</span>
            <span className="block text-label tabular-nums text-muted-fg">{cp.phone}</span>
          </span>
          <ExternalLink className="size-3.5 text-muted-fg" aria-hidden />
        </button>
      )}
      <Facts
        rows={[
          ['Куди дзвонив', call.line],
          ['Розмова', call.dir === 'missed' ? '—' : fmtDuration(call.talkSec)],
          ['Очікування', fmtDuration(call.waitSec)],
          ['Співробітник', op?.name ?? '—'],
          ['Ціль', call.purpose ?? '—'],
        ]}
      />
      <div className="flex flex-col gap-3 px-4 pb-4">
        {call.summary && <AiSummaryNote title="Суть дзвінка">{call.summary}</AiSummaryNote>}
        {call.transcript && (
          <section>
            <h3 className="mb-1 text-mono font-semibold uppercase tracking-wider text-muted-fg">Транскрипція</h3>
            <p className="whitespace-pre-wrap text-body text-fg-2">{call.transcript}</p>
          </section>
        )}
      </div>
    </DrawerFrame>
  )
}

export function TaskDrawer({ id, extra }: { id: string; extra?: ReactNode }) {
  const { world, dispatch } = useStore()
  const { go, openDrawer } = useNav()
  const task = world.tasks.find((t) => t.id === id)
  if (!task) return null
  const cp = cpById(world, task.counterpartyId)
  const overdue = minutesBetween(task.deadlineAt, world.now)
  return (
    <DrawerFrame
      testId="task-drawer"
      title={`${task.title} — ${cp?.name ?? task.phone}`}
      sub={
        <span className="flex items-center gap-1.5">
          <Badge variant={task.status === 'done' ? 'success' : 'warning'}>{task.status === 'done' ? 'Виконана' : 'Нова'}</Badge>
          <span className={cn(overdue > 0 && 'font-medium text-danger-fg')}>
            {overdue > 0 ? `прострочено на ${overdue} хв` : `дедлайн ${timeOf(task.deadlineAt)}`}
          </span>
        </span>
      }
      onClose={() => openDrawer(null)}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="default" size="medium" className="gap-1.5" onClick={() => dispatch({ type: 'TASK_DONE', taskId: task.id })}>
            <Phone className="size-3.5" aria-hidden /> Зателефонувати
          </Button>
          {cp && (
            <Button variant="secondary" size="medium" onClick={() => go({ screen: 'cp', id: cp.id })}>
              Контрагент
            </Button>
          )}
        </div>
      }
    >
      <Facts
        rows={[
          ['Джерело', task.source],
          ['Телефон', <span className="tabular-nums">{task.phone ?? '—'}</span>],
          ['Створено', `${shortDate(task.createdAt)} ${timeOf(task.createdAt)}`],
          ['Спроби', String(task.attempts)],
        ]}
      />
      <div className="flex flex-col gap-3 px-4 pb-4">
        {task.comment && <AiSummaryNote title="Коментар">{task.comment}</AiSummaryNote>}
        {extra}
      </div>
    </DrawerFrame>
  )
}
