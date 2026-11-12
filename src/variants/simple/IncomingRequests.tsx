import { useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CounterpartyAvatar } from '@/components/crm'
import { cpById } from '@/mock/select'
import { ME_BY_ROLE } from '@/mock/world'
import { fmtGap } from '@/lib/time'
import { useLab } from '@/lab/lab-state'
import { useNav } from '@/state/nav'
import { useStore } from '@/state/store'
import { CHANNEL_META } from '../chat/Thread'
import { ownerOf } from '../chat/owner'
import { simpleRows } from './SimplePool'

/**
 * «Нові запити», як у Ringostat Smart Phone (Д, Е): нове повідомлення спливає
 * в усіх операторів і менеджерів, де б вони не були в CRM. Хто перший
 * натиснув «Взяти діалог», той забирає його собі — права панель переходить
 * у розпочатий діалог; в інших запит зникає.
 */
export function IncomingRequests() {
  const { world, dispatch } = useStore()
  const { role } = useLab()
  const { drawer, openDrawer } = useNav()
  const [later, setLater] = useState<Set<string>>(new Set())
  if (role === 'head') return null
  const meId = ME_BY_ROLE[role]
  const free = simpleRows(world).filter((r) => r.wait != null && !ownerOf(world, r.t))
  const shown = free.filter((r) => !later.has(r.t.id) && !(drawer?.kind === 'thread' && drawer.id === r.t.id))
  const r = shown[0]
  if (!r) return null
  const cp = cpById(world, r.t.counterpartyId)
  const Icon = CHANNEL_META[r.last.channel].icon

  return (
    <aside
      className={cn('fixed top-3 z-[61] w-80 overflow-hidden rounded-xl border border-border-strong bg-card shadow-dialog', drawer ? 'right-[456px]' : 'right-4')}
      role="alertdialog"
      aria-label="Новий запит"
      data-incoming=""
    >
      <header className="flex items-center gap-2 bg-success px-3 py-1.5 text-label font-semibold text-white">
        <BellRing className="size-3.5" aria-hidden />
        <span className="flex-1">Нові запити: {free.length}</span>
        <button type="button" onClick={() => setLater((s) => new Set(s).add(r.t.id))} aria-label="Сховати" className="grid size-5 place-items-center rounded hover:bg-white/20">
          <X className="size-3.5" />
        </button>
      </header>
      <div className="flex gap-2.5 px-3 py-2.5">
        <CounterpartyAvatar cp={cp} size={8} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-body font-semibold text-fg">{cp?.name ?? r.t.handle?.name ?? r.t.handle?.value}</span>
            <Icon className="size-3.5 shrink-0 text-accent" aria-label={CHANNEL_META[r.last.channel].label} role="img" />
          </div>
          <p className="line-clamp-2 text-label text-fg-2">{r.last.text}</p>
          <p className="mt-0.5 text-label text-muted-fg">чекає {fmtGap(r.wait ?? 0)} · бачать усі оператори й менеджери</p>
        </div>
      </div>
      <div className="flex gap-2 border-t border-border px-3 py-2">
        <button
          type="button"
          onClick={() => {
            dispatch({ type: 'TAKE', threadId: r.t.id, staffId: meId })
            openDrawer({ kind: 'thread', id: r.t.id, intent: 'reply' })
          }}
          className="h-8 flex-1 rounded-md bg-success text-body font-semibold text-white hover:brightness-95"
          data-take-dialog=""
        >
          Взяти діалог
        </button>
        <button type="button" onClick={() => setLater((s) => new Set(s).add(r.t.id))} className="h-8 rounded-md border border-border px-3 text-body font-medium text-fg-2 hover:bg-muted">
          Пізніше
        </button>
      </div>
    </aside>
  )
}
