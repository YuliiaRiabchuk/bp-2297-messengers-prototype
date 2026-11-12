import { useState } from 'react'
import { ChevronDown, Play, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEMO_SCENES, useLab } from './lab-state'

/**
 * Панель для показу клієнту (`?demo=1`): три сцени простою мовою, підказка,
 * що робити, і «почати спочатку». Без варіантів, ролей і крайніх станів.
 */
export function DemoPanel() {
  const lab = useLab()
  const [open, setOpen] = useState(true)
  if (lab.hidden) return null
  const i = Math.max(0, DEMO_SCENES.findIndex((s) => s.id === lab.sceneId))
  const cur = DEMO_SCENES[i]

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-tooltip inline-flex items-center gap-2 rounded-full bg-fg py-2.5 pl-4 pr-5 text-body font-semibold text-primary-fg shadow-dialog"
      >
        <Play className="size-4" aria-hidden /> Сцена {i + 1} з 3 · {cur.title}
      </button>
    )

  return (
    <aside className="fixed bottom-4 left-4 z-tooltip w-[22rem] overflow-hidden rounded-xl border border-border-strong bg-card shadow-dialog" aria-label="Сцени прототипу" data-demo-panel="">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block text-body font-semibold text-fg">Листування з клієнтом</span>
          <span className="block text-label text-muted-fg">Прототип · дані вигадані</span>
        </span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Згорнути" className="grid size-7 place-items-center rounded-md text-muted-fg hover:bg-muted hover:text-fg">
          <ChevronDown className="size-4" />
        </button>
      </header>
      <ol className="flex flex-col gap-1 p-2">
        {DEMO_SCENES.map((s, n) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => {
                lab.setScene(s.id)
                // Панель не закриває екран сцени: згортається в пігулку з назвою.
                setOpen(false)
              }}
              aria-current={s.id === cur.id ? 'step' : undefined}
              className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left', s.id === cur.id ? 'bg-fg text-primary-fg' : 'text-fg-2 hover:bg-muted')}
            >
              <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-label font-semibold', s.id === cur.id ? 'bg-white/15' : 'bg-muted')}>{n + 1}</span>
              <span className="text-body font-medium">{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="border-t border-border px-4 py-3">
        <p className="text-body text-fg-2">{cur.hint}</p>
        <button type="button" onClick={lab.resetScene} className="mt-2 inline-flex items-center gap-1.5 text-label font-medium text-accent-fg hover:underline">
          <RotateCcw className="size-3" aria-hidden /> Почати сцену спочатку
        </button>
      </div>
    </aside>
  )
}
