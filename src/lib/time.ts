import type { Iso } from '@/mock/types'

/** `2026-11-09T15:34` → Date (локальний час). */
export function toDate(iso: Iso): Date {
  const [d, t = '00:00'] = iso.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [h, min] = t.split(':').map(Number)
  return new Date(y, m - 1, day, h, min)
}

export const timeOf = (iso: Iso) => iso.split('T')[1] ?? ''
export const dayOf = (iso: Iso) => iso.split('T')[0]

/** `09.11` */
export function shortDate(iso: Iso) {
  const [, m, d] = dayOf(iso).split('-')
  return `${d}.${m}`
}

/** `09.11.2026` */
export function fullDate(iso: Iso) {
  const [y, m, d] = dayOf(iso).split('-')
  return `${d}.${m}.${y}`
}

export function minutesBetween(a: Iso, b: Iso) {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 60000)
}

/** Лейбл дня в групі журналу: «Сьогодні», «Вчора», «понеділок, 2 листопада». */
export function dayLabel(iso: Iso, now: Iso) {
  const diff = Math.round((toDate(dayOf(now)).getTime() - toDate(dayOf(iso)).getTime()) / 86400000)
  if (diff === 0) return 'Сьогодні'
  if (diff === 1) return 'Вчора'
  return toDate(iso).toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', year: diff > 300 ? 'numeric' : undefined })
}

/** `2:14` — тривалість розмови як на проді (`fmtDuration`). */
export function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Проміжок людською мовою: «25 хв», «2 год 5 хв», «3 д». */
export function fmtGap(min: number) {
  if (min < 1) return 'менше хвилини'
  if (min < 60) return `${min} хв`
  const h = Math.floor(min / 60)
  if (h >= 24) return `${Math.floor(h / 24)} д${h % 24 ? ` ${h % 24} год` : ''}`
  return min % 60 ? `${h} год ${min % 60} хв` : `${h} год`
}
