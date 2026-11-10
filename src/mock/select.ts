import { dayOf } from '@/lib/time'
import type { CallEvent, Counterparty, Staff, Thread, World } from './types'

/** Рядок журналу «Дзвінки»: дзвінок + чий він. */
export interface CallRow {
  call: CallEvent
  thread: Thread
  counterparty: Counterparty | null
}

export const cpById = (w: World, id: string | null | undefined) => (id ? w.counterparties.find((c) => c.id === id) ?? null : null)
export const staffById = (w: World, id: string | null | undefined): Staff | null => (id ? w.staff.find((s) => s.id === id) ?? null : null)
export const threadById = (w: World, id: string | null | undefined) => (id ? w.threads.find((t) => t.id === id) ?? null : null)
export const threadOfCp = (w: World, cpId: string) => w.threads.find((t) => t.counterpartyId === cpId) ?? null

/** Усі дзвінки світу, нові зверху. */
export function callRows(w: World): CallRow[] {
  const rows: CallRow[] = []
  for (const t of w.threads)
    for (const e of t.events) if (e.kind === 'call') rows.push({ call: e, thread: t, counterparty: cpById(w, t.counterpartyId) })
  return rows.sort((a, b) => b.call.at.localeCompare(a.call.at))
}

/** BP-2300: скільки контактів (дзвінків і переписок) у клієнта цього дня до події включно. */
export function contactsThatDay(t: Thread, atIso: string) {
  const day = dayOf(atIso)
  let n = 0
  let lastWasMsg = false
  for (const e of t.events) {
    if (dayOf(e.at) !== day || e.at > atIso) continue
    if (e.kind === 'call') {
      n++
      lastWasMsg = false
    } else if (e.kind === 'msg' && e.from === 'client') {
      // Переписка — один контакт, поки її не перебив дзвінок.
      if (!lastWasMsg) n++
      lastWasMsg = true
    }
  }
  return n
}

export function displayName(cp: Counterparty) {
  return cp.name
}

export function initials(name: string) {
  const clean = name.replace(/[«»"]/g, '').replace(/^(ТОВ|ФОП|ПП|ПАТ)\s+/u, '')
  const parts = clean.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}
