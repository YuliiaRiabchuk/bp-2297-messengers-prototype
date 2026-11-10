import { cpById } from '@/mock/select'
import type { Iso, Thread, World } from '@/mock/types'

/**
 * Хто веде тред. Хто перший узяв (§3 брифу), а якщо в клієнта є
 * відповідальний менеджер — він, одразу: такі клієнти менеджери ведуть самі
 * (Q6, відповідь 10.11). Оператор бачить «веде» і не бере.
 */
export interface Owner {
  staffId: string
  at: Iso
  responsible: boolean
}

export function ownerOf(world: World, t: Thread): Owner | null {
  if (t.takenBy) return { ...t.takenBy, responsible: false }
  const managerId = cpById(world, t.counterpartyId)?.managerId
  if (managerId) return { staffId: managerId, at: t.events[0]?.at ?? world.now, responsible: true }
  return null
}

/** Скільки хвилин відповідальний менеджер може не відповідати, доки оператор не перехопить. */
export const ESCALATE_MIN = 60

/**
 * Перехопити чуже звернення можна, коли клієнт чекає довше за SLA (15 хв), а
 * клієнта відповідального менеджера — довше за годину. Інакше звернення
 * губиться: «відповідати може тільки той, хто взяв», а той мовчить.
 */
export function canTakeOver(owner: Owner | null, meId: string, waitMin: number | null, sla: number) {
  if (!owner || owner.staffId === meId || waitMin == null) return false
  return waitMin > (owner.responsible ? ESCALATE_MIN : sla)
}
