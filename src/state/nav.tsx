import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * Навігація прототипу: екран і відкритий дровер. Живе в URL (`p`, `d`),
 * щоб посилання відкривало рівно той кадр. Роутера немає: екранів чотири.
 */
export type CallsTab = 'my-calls' | 'all' | 'missed' | 'operators' | 'ai' | 'messengers'

export type Route =
  | { screen: 'calls'; tab: CallsTab }
  | { screen: 'cp'; id: string }
  | { screen: 'mytasks' }

/** `intent: 'sms'` — вікно листування відкрито з колонки «Чат з клієнтом»: SMS з AI-підказкою. */
export type Drawer = { kind: 'call' | 'task' | 'thread'; id: string; intent?: 'sms' | 'reply' } | null

const encodeRoute = (r: Route) => (r.screen === 'calls' ? `calls:${r.tab}` : r.screen === 'cp' ? `cp:${r.id}` : 'mytasks')

function decodeRoute(s: string | null): Route | null {
  if (!s) return null
  const [screen, arg] = s.split(':')
  if (screen === 'calls' && arg) return { screen, tab: arg as CallsTab }
  if (screen === 'cp' && arg) return { screen, id: arg }
  if (screen === 'mytasks') return { screen }
  return null
}

function decodeDrawer(s: string | null): Drawer {
  if (!s) return null
  const [kind, id, intent] = s.split(':')
  if (!((kind === 'call' || kind === 'task' || kind === 'thread') && id)) return null
  return intent === 'sms' || intent === 'reply' ? { kind, id, intent } : { kind, id }
}

interface Nav {
  route: Route
  drawer: Drawer
  go: (r: Route, drawer?: Drawer) => void
  openDrawer: (d: Drawer) => void
}

const Ctx = createContext<Nav | null>(null)

/**
 * Екран з URL діє тільки для першої сцени, з якою відкрили сторінку; зміна
 * сцени ставить її точку входу. Ключ сцени, а не прапор «перше монтування»:
 * StrictMode викликає ініціалізатор двічі, і прапор губив URL на другому.
 */
const urlEntry = (() => {
  const q = new URLSearchParams(window.location.search)
  const r = decodeRoute(q.get('p'))
  return r ? { route: r, drawer: decodeDrawer(q.get('d')) } : null
})()
let urlEntryKey: string | null = null

export function NavProvider({ entry, sceneKey, children }: { entry: { route: Route; drawer: Drawer }; sceneKey: string; children: ReactNode }) {
  const [state, setState] = useState(() => {
    if (urlEntry && (urlEntryKey === null || urlEntryKey === sceneKey)) {
      urlEntryKey = sceneKey
      return urlEntry
    }
    return entry
  })

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    q.set('p', encodeRoute(state.route))
    if (state.drawer) q.set('d', `${state.drawer.kind}:${state.drawer.id}${state.drawer.intent ? `:${state.drawer.intent}` : ''}`)
    else q.delete('d')
    window.history.replaceState(null, '', `${window.location.pathname}?${q}`)
  }, [state])

  const go = useCallback((route: Route, drawer: Drawer = null) => setState({ route, drawer }), [])
  const openDrawer = useCallback((drawer: Drawer) => setState((s) => ({ ...s, drawer })), [])
  const value = useMemo(() => ({ ...state, go, openDrawer }), [state, go, openDrawer])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNav(): Nav {
  const n = useContext(Ctx)
  if (!n) throw new Error('useNav outside NavProvider')
  return n
}
