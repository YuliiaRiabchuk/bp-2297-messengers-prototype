import { MessagesSquare } from 'lucide-react'
import { Proposal } from '@/components/proposal'
import { TaskDrawer } from '@/screens/drawers'
import { threadOfCp } from '@/mock/select'
import { useNav } from '@/state/nav'
import { useStore } from '@/state/store'
import type { VariantImpl } from '../registry'
import { CardComms } from './CardComms'
import { ChatCell, ContactCount, MessengersTab, MessengersTabLabel, MissedMessageRows, missedMessageRows } from './Pool'
import { Thread } from './Thread'

/**
 * Варіант Б — «тред зі зверненнями» (docs/shape.md). Прод-екрани ті самі,
 * варіант додає: шосту вкладку «Месенджери», колонку «Чат з клієнтом» і
 * лічильник контактів у «Усіх», повідомлення без відповіді в «Пропущених»,
 * віджет «Комунікації» в картці, кнопку «Листування» в задачі. Вікно
 * листування — один `Thread` для всіх входів.
 */

function ThreadDrawer({ id, intent }: { id: string; intent?: 'sms' }) {
  const { openDrawer } = useNav()
  return <Thread key={`${id}:${intent ?? ''}`} threadId={id} host="drawer" intent={intent} onClose={() => openDrawer(null)} />
}

function TaskDrawerB({ id }: { id: string }) {
  const { world } = useStore()
  const { openDrawer } = useNav()
  const task = world.tasks.find((t) => t.id === id)
  const thread = task?.counterpartyId ? threadOfCp(world, task.counterpartyId) : null
  const msgs = thread?.events.filter((e) => e.kind === 'msg') ?? []
  return (
    <TaskDrawer
      id={id}
      extra={
        thread && (
          <button
            type="button"
            onClick={() => openDrawer({ kind: 'thread', id: thread.id })}
            className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-left hover:border-border-strong hover:bg-muted/40"
            data-open-thread=""
          >
            <MessagesSquare className="size-4 text-muted-fg" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-body font-medium text-fg">Листування</span>
              <span className="block truncate text-label text-muted-fg">
                {msgs.length ? `${msgs.length} повідомл. · останнє: ${(msgs[msgs.length - 1] as { text: string }).text}` : 'Клієнт ще не писав'}
              </span>
            </span>
            <Proposal />
          </button>
        )
      }
    />
  )
}

function MessengersLabel() {
  const { world } = useStore()
  return <MessengersTabLabel world={world} />
}

export const VARIANT_B: VariantImpl = {
  calls: (w) => ({
    extraTab: { key: 'messengers', label: 'Месенджери', count: <MessengersLabel />, render: () => <MessengersTab /> },
    allColumn: { label: 'Чат з клієнтом', width: 160, cell: (r) => <ChatCell r={r} /> },
    contactExtra: (r) => <ContactCount r={r} />,
    missedExtra: () => <MissedMessageRows />,
    missedExtraCount: missedMessageRows(w).length,
  }),
  card: {
    fullAfterOps: (cp, t) => <CardComms cp={cp} thread={t} />,
  },
  drawer: (d) => {
    if (d.kind === 'thread') return <ThreadDrawer id={d.id} intent={d.intent} />
    if (d.kind === 'task') return <TaskDrawerB id={d.id} />
    return undefined
  },
  entry: (e, w) => {
    const cp = w.focus.counterpartyId
    switch (e) {
      case 'pool':
        return { route: { screen: 'calls', tab: 'messengers' }, drawer: null }
      case 'journal':
        return { route: { screen: 'calls', tab: 'all' }, drawer: null }
      case 'card':
        return cp ? { route: { screen: 'cp', id: cp }, drawer: null } : undefined
      case 'tasks':
        return { route: { screen: 'mytasks' }, drawer: null }
    }
  },
}

