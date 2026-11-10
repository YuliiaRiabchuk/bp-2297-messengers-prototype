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
