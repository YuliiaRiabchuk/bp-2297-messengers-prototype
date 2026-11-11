import type { ReactNode } from 'react'
import type { Entry } from '@/lab/scenes'
import type { World } from '@/mock/types'
import type { Drawer, Route } from '@/state/nav'
import { useStore } from '@/state/store'
import type { CallsExt } from '@/screens/calls/CallsPage'
import type { CardSlots } from '@/screens/cp/CounterpartyPage'
import { SevaChatsWidget, sevaHistoryLines } from './v0b/SevaChats'
import type { Counterparty, Thread } from '@/mock/types'
import { chatVariant } from './chat-variants'
import { VARIANT_D, VARIANT_E, VARIANT_G } from './simple'

/**
 * Реалізація варіанта: що він додає до прод-екранів і куди веде точка входу
 * сцени. Варіант 0 — порожній: це прод як є.
 */
export interface VariantImpl {
  calls?: (w: World) => CallsExt
  card?: CardSlots
  /** Свій дровер (напр. вікно листування `thread`). */
  drawer?: (d: NonNullable<Drawer>) => ReactNode | undefined
  /** Куди веде точка входу сцени в цьому варіанті. */
  entry?: (e: Entry, w: World) => { route: Route; drawer: Drawer } | undefined
  /** Перехід по CRM згортає відкритий чат у віджет (Д, Е). */
  keepChat?: boolean
  /** Віджет чату поверх CRM. */
  widget?: (threadId: string) => ReactNode
  /** Перетворення даних сцени під скоуп варіанта (Е: Viber поза скоупом). */
  transformWorld?: (w: World) => World
}

/** Точки входу проду: пулу немає, повідомлення живуть у Ringostat. */
export function prodEntry(e: Entry, w: World): { route: Route; drawer: Drawer } {
  const cp = w.focus.counterpartyId
  switch (e) {
    case 'card':
      return cp ? { route: { screen: 'cp', id: cp }, drawer: null } : { route: { screen: 'calls', tab: 'all' }, drawer: null }
    case 'tasks':
      return { route: { screen: 'mytasks' }, drawer: null }
    case 'journal':
    case 'pool':
      return { route: { screen: 'calls', tab: 'all' }, drawer: null }
  }
}

function SevaSlot({ cp, thread }: { cp: Counterparty; thread: Thread | null }) {
  const { world } = useStore()
  return <SevaChatsWidget world={world} cp={cp} thread={thread} />
}

const SEVA_CARD: CardSlots = {
  fullAfterOps: (cp, t) => <SevaSlot cp={cp} thread={t} />,
}

export const IMPLS: Record<string, VariantImpl> = {
  '0': {},
  '0б': { card: SEVA_CARD },
  'А': chatVariant('A'),
  'Б': chatVariant('Б'),
  'В': chatVariant('В'),
  'Г': VARIANT_G,
  'Д': VARIANT_D,
  'Е': VARIANT_E,
}

/** Історія з діалогами Севи потребує світу — віддаємо фабрику. */
export function cardSlotsFor(code: string, world: World): CardSlots | undefined {
  if (code === '0б')
    return {
      ...SEVA_CARD,
      historyExtra: (t) => sevaHistoryLines(world, world.counterparties.find((c) => c.id === t.counterpartyId) ?? null, t),
    }
  return IMPLS[code]?.card
}
