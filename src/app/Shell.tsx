import type { ReactNode } from 'react'
import {
  BookOpen,
  Boxes,
  CalendarClock,
  CheckSquare,

  FileText,
  Home,
  Landmark,
  ListChecks,
  Package,
  Phone,
  Settings,
  Tag,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/crm'
import { useNav, type Route } from '@/state/nav'
import { useStore } from '@/state/store'
import { useLab } from '@/lab/lab-state'
import { ME_BY_ROLE } from '@/mock/world'
import { staffById } from '@/mock/select'

/**
 * Оболонка CRM за `components/layout/{AppLayout,Sidebar}.tsx`: сайдбар `w-52`
 * на тлі shell, робоча область — біла картка `rounded-xl`, праворуч слот
 * master-detail. Живі пункти — тільки ті, що потрібні сценам; решта стоїть
 * для впізнаваності й нікуди не веде.
 */

interface NavItem {
  label: string
  icon: typeof Home
  route?: Route
  count?: number
  match?: (r: Route) => boolean
}

export function Shell({ drawer, children }: { drawer?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-screen w-full gap-1 overflow-hidden bg-shell p-1">
      <Sidebar />
      <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border-strong bg-card">
          <main id="main-content" className="relative min-h-0 flex-1 overflow-hidden">
            {children}
          </main>
        </div>
        {drawer && (
          <aside
            className="flex h-full min-h-0 w-[440px] shrink-0 flex-col overflow-hidden rounded-xl border border-border-strong bg-card"
            data-testid="drawer"
          >
            {drawer}
          </aside>
        )}
      </div>
    </div>
  )
}

function Sidebar() {
  const { route, go } = useNav()
  const { world } = useStore()
  const { role } = useLab()
  const me = staffById(world, ME_BY_ROLE[role])
  const myTasks = world.tasks.filter((t) => t.status !== 'done' && (t.assigneeId === null || t.assigneeId === me?.id)).length

  const groups: { label?: string; items: NavItem[] }[] = [
    {
      items: [
        { label: 'Головна', icon: Home },
        { label: 'Мої задачі', icon: ListChecks, route: { screen: 'mytasks' }, count: myTasks || undefined, match: (r) => r.screen === 'mytasks' },
        { label: 'Задачі', icon: CheckSquare },
        { label: 'Дзвінки', icon: Phone, route: { screen: 'calls', tab: 'my-calls' }, match: (r) => r.screen === 'calls' },
      ],
    },
    {
      label: 'Замовлення',
      items: [
        { label: 'Оренди', icon: Package },
        { label: 'Банк', icon: Landmark },
        { label: 'Каса', icon: Wallet },
        { label: 'Резерви', icon: CalendarClock },
      ],
    },
    {
      label: 'Контрагенти',
      items: [
        { label: 'Контрагенти', icon: Users, match: (r) => r.screen === 'cp' },
        { label: 'Інтереси', icon: Tag },
      ],
    },
    { label: 'Документи', items: [{ label: 'Документи', icon: FileText }] },
    {
      label: 'Склади',
      items: [
        { label: 'Каталог', icon: BookOpen },
        { label: 'Склади', icon: Warehouse },
        { label: 'Рухи', icon: Boxes },
      ],
    },
    { label: 'Налаштування', items: [{ label: 'Налаштування', icon: Settings }] },
  ]

  return (
    <aside className="flex w-52 shrink-0 flex-col gap-0.5 overflow-hidden bg-shell p-1.5">
      <div className="flex items-center gap-2.5 pb-3.5 pt-1.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-fg text-[13px] font-bold text-primary-fg" aria-hidden>
          Б
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-body font-semibold tracking-tight">Будпрокат</span>
          <span className="truncate text-mono uppercase tracking-wider text-muted-fg">CRM</span>
        </div>
      </div>
      <nav className="-mr-1.5 min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-1 pr-1.5" aria-label="Розділи">
        {groups.map((g, i) => (
          <div key={g.label ?? i} className={cn('flex flex-col gap-0.5', i > 0 && 'mt-6')}>
            {g.label && <div className="mb-0.5 px-2.5 text-mono font-medium text-muted-fg">{g.label}</div>}
            {g.items.map((it) => {
              const active = it.match?.(route) ?? false
              const Icon = it.icon
              return (
                <button
                  key={it.label + (g.label ?? '')}
                  type="button"
                  onClick={() => it.route && go(it.route)}
                  aria-current={active ? 'page' : undefined}
                  data-nav={it.label}
                  className={cn(
                    'flex h-[30px] items-center gap-2.5 overflow-hidden rounded-md px-2.5 text-left text-body font-medium transition-colors',
                    active ? 'bg-fg text-primary-fg' : 'text-fg-2 hover:bg-shell-hover hover:text-fg',
                    !it.route && !active && 'cursor-default',
                  )}
                >
                  <Icon className="size-3.5 shrink-0 opacity-90" />
                  <span className="min-w-0 truncate">{it.label}</span>
                  {it.count != null && (
                    <span
                      className={cn(
                        'ml-auto inline-flex shrink-0 items-center justify-center rounded-full px-1.5 py-px text-mono font-medium tabular-nums',
                        active ? 'bg-card text-fg' : 'bg-card text-muted-fg',
                      )}
                    >
                      {it.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-border-strong pt-3">
        <div className="flex items-center gap-2.5 px-2">
          <Avatar name={me?.name} size={7} tone="muted" />
          <span className="flex min-w-0 flex-col text-left">
            <span className="truncate text-body font-medium">{me?.name}</span>
            <span className="truncate text-mono text-muted-fg">{me?.team}</span>
          </span>
        </div>
      </div>
    </aside>
  )
}
