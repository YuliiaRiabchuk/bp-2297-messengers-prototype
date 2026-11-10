import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type { MsgEvent, Thread, World } from '@/mock/types'

/**
 * Стан даних сцени. Перезбирається з нуля (`key`) при зміні сцени або
 * варіанта: варіанти порівнюються з однієї точки.
 *
 * `window.__bp` віддає стан прогону `walk.mjs`: результат перевіряється за
 * даними, а не за картинкою.
 */
export type Action =
  | { type: 'TAKE'; threadId: string; staffId: string }
  | { type: 'SEND'; threadId: string; msg: Omit<MsgEvent, 'id' | 'kind' | 'at'> }
  | { type: 'BIND'; threadId: string; counterpartyId: string }
  | { type: 'TASK_DONE'; taskId: string }
  | { type: 'CREATE_TEMP'; threadId: string; name: string; phone: string | null }
  | { type: 'CLOSE'; threadId: string }
  | { type: 'SYSTEM'; threadId: string; text: string }
  | { type: 'DELIVER'; threadId: string; eventId: string; delivery: 'delivered' | 'failed' }

function reducer(w: World, a: Action): World {
  const patch = (id: string, f: (t: Thread) => Thread) => ({ ...w, threads: w.threads.map((t) => (t.id === id ? f(t) : t)) })
  switch (a.type) {
    case 'TAKE':
      return patch(a.threadId, (t) => (t.takenBy ? t : { ...t, takenBy: { staffId: a.staffId, at: w.now } }))
    case 'SEND':
      return patch(a.threadId, (t) => ({
        ...t,
        takenBy: t.takenBy ?? (a.msg.staffId ? { staffId: a.msg.staffId, at: w.now } : undefined),
        closedAt: undefined,
        events: [...t.events, { ...a.msg, id: `sent${t.events.length}`, kind: 'msg', at: w.now }],
      }))
    case 'BIND':
      return patch(a.threadId, (t) => ({ ...t, counterpartyId: a.counterpartyId }))
    case 'CREATE_TEMP': {
      const id = `tmp-${a.threadId}`
      const t = w.threads.find((x) => x.id === a.threadId)
      const cp = { id, name: a.name, kind: 'TEMP' as const, phone: a.phone, telegram: t?.handle?.channel === 'telegram' ? t.handle.value : undefined, viber: t?.handle?.channel === 'viber' ? t.handle.value : undefined }
      return { ...w, counterparties: [...w.counterparties, cp], threads: w.threads.map((x) => (x.id === a.threadId ? { ...x, counterpartyId: id } : x)) }
    }
    case 'SYSTEM':
      return patch(a.threadId, (t) => ({ ...t, events: [...t.events, { id: `sys${t.events.length}`, kind: 'system', at: w.now, text: a.text }] }))
    case 'CLOSE':
      return patch(a.threadId, (t) => ({ ...t, closedAt: w.now }))
    case 'DELIVER':
      return patch(a.threadId, (t) => ({ ...t, events: t.events.map((e) => (e.id === a.eventId && e.kind === 'msg' ? { ...e, delivery: a.delivery } : e)) }))
    case 'TASK_DONE':
      return { ...w, tasks: w.tasks.map((t) => (t.id === a.taskId ? { ...t, status: 'done' } : t)) }
  }
}

interface Store {
  world: World
  dispatch: (a: Action) => void
}

const Ctx = createContext<Store | null>(null)

declare global {
  interface Window {
    __bp?: { world: World; dispatch: (a: Action) => void }
  }
}

export function StoreProvider({ initial, children }: { initial: World; children: ReactNode }) {
  const [world, dispatch] = useReducer(reducer, initial)
  useEffect(() => {
    window.__bp = { world, dispatch }
  }, [world])
  const value = useMemo(() => ({ world, dispatch }), [world])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside StoreProvider')
  return s
}
