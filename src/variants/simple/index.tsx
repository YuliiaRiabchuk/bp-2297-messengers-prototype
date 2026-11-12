import { SectionCard, PageTabCount } from '@/components/crm'
import { Proposal } from '@/components/proposal'
import { useNav } from '@/state/nav'
import { useStore } from '@/state/store'
import type { World } from '@/mock/types'
import type { VariantImpl } from '../registry'
import { TaskDrawerWithThread } from '../chat-variants'
import { ChatCell, ContactCount, MissedMessageRows, missedMessageRows } from '../chat/Pool'
import { ChatWidget, SimpleChat, type Flavor } from './SimpleChat'
import { SimplePool, simpleRows } from './SimplePool'
import { CommsPage } from './CommsPage'
import { IncomingRequests } from './IncomingRequests'

/**
 * Г — простий чат за PM-синком 10.11. Д — Г + коментарі Уракова (підписи,
 * віджет, вкладка з досьє). Е — Д + планування 10.11 (30 днів тредами, суть
 * дзвінка, останній контакт веде, Telegram Business, Viber поза скоупом).
 */

function Drawer({ id, intent, flavor }: { id: string; intent?: 'sms' | 'reply'; flavor: Flavor }) {
  const { openDrawer } = useNav()
  return <SimpleChat key={`${id}:${intent ?? ''}`} threadId={id} host="drawer" intent={intent} flavor={flavor} onClose={() => openDrawer(null)} />
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

/** Е: Viber поза скоупом — чати Viber у моках стають Telegram (клієнт пише на Telegram Business 067). */
function noViber(w: World): World {
  return {
    ...w,
    counterparties: w.counterparties.map((c) => (c.viber && !c.telegram ? { ...c, telegram: c.viber, viber: undefined } : { ...c, viber: undefined })),
    threads: w.threads.map((t) => ({
      ...t,
      handle: t.handle?.channel === 'viber' ? { ...t.handle, channel: 'telegram' } : t.handle,
      events: t.events.map((e) =>
        e.kind === 'msg' && e.channel === 'viber' ? { ...e, channel: 'telegram' } : e.kind === 'msg' && e.channel === 'viber-notify' ? { ...e, channel: 'sms' } : e,
      ),
    })),
  }
}

function makeSimple(flavor: Flavor): VariantImpl {
  return {
    calls: (w) => ({
      extraTab: { key: 'messengers', label: 'Месенджери', count: <TabCount />, render: () => <SimplePool flavor={flavor} /> },
      allColumn: { label: 'Чат з клієнтом', width: 160, cell: (r) => <ChatCell r={r} /> },
      contactExtra: (r) => <ContactCount r={r} />,
      missedExtra: () => <MissedMessageRows kind="A" />,
      missedExtraCount: missedMessageRows(w, 'A').length,
    }),
    card: {
      forceLayout: 'tabs',
      historyOpsOnly: true,
      comms: (cp, t) =>
        flavor === 'Г' ? (
          t ? (
            <SectionCard className="h-full" bodyClassName="flex-1" data-testid="card-comms">
              <SimpleChat threadId={t.id} host="card" />
            </SectionCard>
          ) : (
            <p className="py-10 text-center text-body text-muted-fg" data-empty-chat="">
              З клієнтом ще не було ні дзвінків, ні листування.
            </p>
          )
        ) : (
          <CommsPage cp={cp} thread={t} flavor={flavor} />
        ),
    },
    drawer: (d) => {
      if (d.kind === 'thread') return <Drawer id={d.id} intent={d.intent} flavor={flavor} />
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
    ...(flavor !== 'Г' ? { keepChat: true, widget: (id: string) => <ChatWidget threadId={id} flavor={flavor} />, overlay: () => <IncomingRequests /> } : {}),
    ...(flavor === 'Е' ? { transformWorld: noViber } : {}),
  }
}

export const VARIANT_G = makeSimple('Г')
export const VARIANT_D = makeSimple('Д')
export const VARIANT_E = makeSimple('Е')
