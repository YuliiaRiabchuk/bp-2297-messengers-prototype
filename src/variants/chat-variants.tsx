import { MessagesSquare } from 'lucide-react'
import { Proposal } from '@/components/proposal'
import { TaskDrawer } from '@/screens/drawers'
import { threadOfCp } from '@/mock/select'
import { useNav } from '@/state/nav'
import { useStore } from '@/state/store'
import type { VariantImpl } from './registry'
import { CardComms, type CommsKind } from './chat/CardComms'
import { ChatCell, ContactCount, MessengersTab, MessengersTabLabel, MissedMessageRows, missedMessageRows } from './chat/Pool'
import { Thread } from './chat/Thread'

/**
 * Варіанти А, Б, В (docs/shape.md) — одна збірка з трьома ручками: який
 * пул у «Месенджерах», як нарізано тред, що в картці ліворуч від треду.
 *
 * Спільне для всіх: шоста вкладка «Месенджери», колонка «Чат з клієнтом» і
 * лічильник контактів у «Усіх», повідомлення без відповіді в «Пропущених»,
 * листування в картці (положення — Q3), «Листування» в задачі. Вікно
 * листування — один `Thread` для всіх чотирьох входів.
 */

const THREAD_MODE = { A: 'flat', Б: 'episodes', В: 'current' } as const

function ThreadDrawer({ kind, id, intent }: { kind: CommsKind; id: string; intent?: 'sms' | 'reply' }) {
  const { openDrawer } = useNav()
  return <Thread key={`${id}:${intent ?? ''}`} threadId={id} host="drawer" intent={intent} mode={THREAD_MODE[kind]} onClose={() => openDrawer(null)} />
}

function TaskDrawerWithThread({ id }: { id: string }) {
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

function MessengersLabel({ kind }: { kind: CommsKind }) {
  const { world } = useStore()
  return <MessengersTabLabel world={world} kind={kind} />
}

export function chatVariant(kind: CommsKind): VariantImpl {
  return {
    calls: (w) => ({
      extraTab: { key: 'messengers', label: 'Месенджери', count: <MessengersLabel kind={kind} />, render: () => <MessengersTab kind={kind} /> },
      allColumn: { label: 'Чат з клієнтом', width: 160, cell: (r) => <ChatCell r={r} /> },
      contactExtra: (r) => <ContactCount r={r} />,
      missedExtra: () => <MissedMessageRows kind={kind} />,
      missedExtraCount: missedMessageRows(w, kind).length,
    }),
    card: {
      comms: (cp, t, layout) => <CardComms kind={kind} layout={layout} cp={cp} thread={t} />,
    },
    drawer: (d) => {
      if (d.kind === 'thread') return <ThreadDrawer kind={kind} id={d.id} intent={d.intent} />
      if (d.kind === 'task') return <TaskDrawerWithThread id={d.id} />
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
}
