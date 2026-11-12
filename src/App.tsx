import { useMemo } from 'react'
import { LabProvider, useLab } from '@/lab/lab-state'
import { LabWidget } from '@/lab/LabWidget'
import { DemoPanel } from '@/lab/DemoPanel'
import type { Route } from '@/state/nav'
import { SCENE_BY_ID } from '@/lab/scenes'
import { Toaster } from '@/components/ui/toast'
import { buildWorld } from '@/mock/world'
import { StoreProvider, useStore } from '@/state/store'
import { NavProvider, useNav } from '@/state/nav'
import { Shell } from '@/app/Shell'
import { CallsPage } from '@/screens/calls/CallsPage'
import { CounterpartyPage } from '@/screens/cp/CounterpartyPage'
import { MyTasksPage } from '@/screens/tasks/MyTasksPage'
import { StubPage } from '@/screens/StubPage'
import { CallDrawer, TaskDrawer } from '@/screens/drawers'
import { IMPLS, cardSlotsFor, prodEntry } from '@/variants/registry'

/**
 * Одна адреса: варіант, сцена й роль — у query (`v`, `scene`, `role`), екран
 * і дровер — теж (`p`, `d`). Стор і навігація перезбираються з нуля, коли
 * міняється сцена або варіант: варіанти порівнюються з однієї точки.
 */
export default function App() {
  return (
    <LabProvider>
      <Frame />
    </LabProvider>
  )
}

function Frame() {
  const { resetKey, sceneId, variant, demo } = useLab()
  const impl = IMPLS[variant] ?? {}
  const world = useMemo(() => {
    const w = buildWorld(sceneId)
    return impl.transformWorld ? impl.transformWorld(w) : w
  }, [sceneId, resetKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const scene = SCENE_BY_ID.get(sceneId)!
  // Показ клієнту: кожна сцена відкривається одразу там, де її дивляться.
  const demoEntry: Record<string, Route> = {
    'no-reply': { screen: 'calls', tab: 'messengers' },
    'mixed-day': { screen: 'cp', id: 'cp-koval' },
    'regular-ul': { screen: 'cp', id: 'cp-ul' },
  }
  const entry =
    demo && demoEntry[sceneId]
      ? { route: demoEntry[sceneId], drawer: null }
      : impl.entry?.(scene.entry, world) ?? prodEntry(scene.entry, world)
  return (
    <>
      <StoreProvider key={resetKey} initial={world}>
        <NavProvider key={resetKey} sceneKey={resetKey} entry={entry} keepChat={!!impl.keepChat}>
          <Screens />
        </NavProvider>
      </StoreProvider>
      {demo ? <DemoPanel /> : <LabWidget />}
      <Toaster />
    </>
  )
}

function Screens() {
  const { variant } = useLab()
  const { world } = useStore()
  const { route, drawer, dock } = useNav()
  const impl = IMPLS[variant] ?? {}

  const drawerNode = drawer
    ? impl.drawer?.(drawer) ??
      (drawer.kind === 'call' ? <CallDrawer id={drawer.id} /> : drawer.kind === 'task' ? <TaskDrawer id={drawer.id} /> : null)
    : null

  return (
    <Shell drawer={drawerNode}>
      {route.screen === 'calls' && <CallsPage ext={impl.calls?.(world)} />}
      {route.screen === 'cp' && <CounterpartyPage id={route.id} slots={cardSlotsFor(variant, world)} />}
      {route.screen === 'mytasks' && <MyTasksPage />}
      {route.screen === 'stub' && <StubPage name={route.name} />}
      {dock && impl.widget?.(dock)}
      {impl.overlay?.()}
    </Shell>
  )
}
