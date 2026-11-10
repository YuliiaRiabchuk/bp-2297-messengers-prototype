import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { CELL, ContactCell, FULL_BLEED, HEAD_CELL, PageTab, PageTabCount, PageTabStrip } from '@/components/crm'
import { cpById } from '@/mock/select'
import { ME_BY_ROLE } from '@/mock/world'
import { minutesBetween, shortDate, timeOf } from '@/lib/time'
import { useLab } from '@/lab/lab-state'
import { useNav } from '@/state/nav'
import { useStore } from '@/state/store'

/**
 * «Мої задачі» (`routes/_authed.mytasks.tsx`), спрощено до задач
 * «Передзвонити»: на мене або на колл-центр. Точка входу 3 (BP-2306).
 */
export function MyTasksPage() {
  const { world } = useStore()
  const { role } = useLab()
  const { go, openDrawer, drawer } = useNav()
  const meId = ME_BY_ROLE[role]
  const tasks = world.tasks.filter((t) => t.status !== 'done' && (t.assigneeId === null || t.assigneeId === meId))
  return (
    <div className="flex h-full min-w-0 flex-col">
      <PageTabStrip>
        <PageTab active onClick={() => {}}>
          В роботі
          <PageTabCount tone="warning">{tasks.length}</PageTabCount>
        </PageTab>
      </PageTabStrip>
      <div className="min-h-0 flex-1 overflow-auto pt-3">
        <table className={cn('w-full min-w-[760px] table-fixed border-separate border-spacing-0', FULL_BLEED)} data-testid="mytasks">
          <colgroup>
            <col style={{ width: 150 }} />
            <col style={{ width: 240 }} />
            <col />
            <col style={{ width: 170 }} />
          </colgroup>
          <thead>
            <tr>
              <th className={HEAD_CELL}>Задача</th>
              <th className={HEAD_CELL}>Контрагент</th>
              <th className={HEAD_CELL}>Джерело</th>
              <th className={HEAD_CELL}>Дедлайн</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const cp = cpById(world, t.counterpartyId)
              const overdue = minutesBetween(t.deadlineAt, world.now)
              const active = drawer?.kind === 'task' && drawer.id === t.id
              return (
                <tr
                  key={t.id}
                  onClick={() => openDrawer({ kind: 'task', id: t.id })}
                  className={cn('cursor-pointer', active ? 'bg-accent-soft' : 'hover:bg-muted/50')}
                  data-task={t.id}
                >
                  <td className={cn(CELL, 'font-medium text-fg')}>{t.title}</td>
                  <td className={cn(CELL, 'relative')}>
                    <ContactCell cp={cp} phone={t.phone} onOpen={() => cp && go({ screen: 'cp', id: cp.id })} />
                  </td>
                  <td className={CELL}>
                    <Badge variant="outline">{t.source}</Badge>
                  </td>
                  <td className={CELL}>
                    <span className={cn('block whitespace-nowrap', overdue > 0 ? 'font-medium text-danger-fg' : 'text-warning-fg')}>
                      {overdue > 0 ? `прострочено на ${overdue} хв` : `через ${-overdue} хв`}
                    </span>
                    <span className="text-label tabular-nums text-muted-fg">
                      {shortDate(t.deadlineAt)} {timeOf(t.deadlineAt)}
                    </span>
                  </td>
                </tr>
              )
            })}
            {!tasks.length && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-body text-subtle">
                  Немає задач за обраними фільтрами
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
