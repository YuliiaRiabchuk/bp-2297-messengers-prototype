import { SectionCard } from '@/components/crm'
import { useNav } from '@/state/nav'
import { useStore } from '@/state/store'
import type { VariantImpl } from '../registry'
import { TaskDrawerWithThread } from '../chat-variants'
import { ChatCell, ContactCount, MissedMessageRows, missedMessageRows } from '../chat/Pool'
import { PageTabCount } from '@/components/crm'
import { Proposal } from '@/components/proposal'
import { SimpleChat } from './SimpleChat'
import { SimplePool, simpleRows } from './SimplePool'

/** Варіант Г — простий чат за PM-синком 10.11 (docs/pm-sync-2026-11-10.md). */

function Drawer({ id, intent }: { id: string; intent?: 'sms' | 'reply' }) {
  const { openDrawer } = useNav()
  return <SimpleChat key={`${id}:${intent ?? ''}`} threadId={id} host="drawer" intent={intent} onClose={() => openDrawer(null)} />
}

function TabCount() {
  const { world } = useStore()
  const n = simpleRows(world).filter((r) => r.wait != null).length
  return (
    <>
      <Proposal />
      {n > 0 && <PageTabCount tone="warning">{n}</PageTabCount>}
    </>
  )
}

export const VARIANT_G: VariantImpl = {
  calls: (w) => ({
    extraTab: { key: 'messengers', label: 'Месенджери', count: <TabCount />, render: () => <SimplePool /> },
    allColumn: { label: 'Чат з клієнтом', width: 160, cell: (r) => <ChatCell r={r} /> },
    contactExtra: (r) => <ContactCount r={r} />,
    missedExtra: () => <MissedMessageRows kind="A" />,
    missedExtraCount: missedMessageRows(w, 'A').length,
  }),
  card: {
    forceLayout: 'tabs',
    historyOpsOnly: true,
    comms: (_cp, t) =>
      t ? (
        <SectionCard className="h-full" bodyClassName="flex-1" data-testid="card-comms">
          <SimpleChat threadId={t.id} host="card" />
        </SectionCard>
      ) : (
        <p className="py-10 text-center text-body text-muted-fg" data-empty-chat="">
          З клієнтом ще не було ні дзвінків, ні листування.
        </p>
      ),
  },
  drawer: (d) => {
    if (d.kind === 'thread') return <Drawer id={d.id} intent={d.intent} />
    if (d.kind === 'task') return <TaskDrawerWithThread id={d.id} />
    return undefined
  },
  entry: (e, w) => {
    const cp = w.focus.counterpartyId
    if (e === 'pool') return { route: { screen: 'calls', tab: 'messengers' }, drawer: null }
    if (e === 'journal') return { route: { screen: 'calls', tab: 'all' }, drawer: null }
    if (e === 'card') return cp ? { route: { screen: 'cp', id: cp }, drawer: null } : undefined
    return { route: { screen: 'mytasks' }, drawer: null }
  },
}
