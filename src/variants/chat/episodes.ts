import { minutesBetween } from '@/lib/time'
import type { Iso, MsgChannel, Occasion, Summary, Thread, ThreadEvent } from '@/mock/types'

/**
 * Звернення варіанта Б (пропозиція): тред лишається один, але нарізаний.
 *
 * Межа звернення (§4 брифу): 72 год без подій або новий привід — клієнт
 * прийшов за посиланням на резерв чи оренду. Резерв, створений усередині
 * розмови, межі не ставить: це результат звернення, а не новий привід.
 */
export const GAP_MIN = 72 * 60
/** Скільки хвилин повідомлення може чекати, доки не стане «пропущеним» (Q15). */
export const SLA_MIN = 15

export type EpisodeStatus = 'waiting_us' | 'waiting_client' | 'open' | 'closed'
export type EpisodeResult = 'rent' | 'reserve' | 'none' | null

export interface Episode {
  index: number
  events: ThreadEvent[]
  start: Iso
  end: Iso
  /** Привід: з посилання або створений у зверненні. */
  occasion: Occasion | null
  status: EpisodeStatus
  result: EpisodeResult
  /** Відколи клієнт чекає нашої відповіді. */
  waitingSince: Iso | null
  channels: MsgChannel[]
  /** Привід успадковано від оренди, що триває. */
  inherited: boolean
}

const isLink = (e: ThreadEvent) => e.kind === 'system' && !!e.occasion && /посиланням/.test(e.text)

/** Подія клієнта, що чекає реакції: повідомлення клієнта або пропущений дзвінок. */
const fromClient = (e: ThreadEvent) => (e.kind === 'msg' && e.from === 'client') || (e.kind === 'call' && e.dir === 'missed')
/** Наша реакція: відповідь співробітника, вихідний чи прийнятий дзвінок. */
/** Недоставлене SMS — не відповідь: клієнт нічого не отримав. */
const fromUs = (e: ThreadEvent) => (e.kind === 'msg' && e.from === 'staff' && e.delivery !== 'failed') || (e.kind === 'call' && e.dir !== 'missed')

export function episodesOf(t: Thread, now: Iso): Episode[] {
  const groups: ThreadEvent[][] = []
  for (const e of t.events) {
    const cur = groups[groups.length - 1]
    const prev = cur?.[cur.length - 1]
    if (!cur || isLink(e) || (prev && minutesBetween(prev.at, e.at) > GAP_MIN)) groups.push([e])
    else cur.push(e)
  }
  // Оренда, що триває: звернення без власного приводу, яке почалось у строк
  // оренди, стосується її (продовження, оплата, рахунок), а не «нічого не
  // вийшло». Строк — `until` оренди; оренда без строку нічого не передає, а
  // звернення після її кінця — новий запит, не продовження старого.
  let activeRent: Occasion | null = null
  return groups.map((events, index) => {
    const last = index === groups.length - 1
    const end = events[events.length - 1].at
    let occasion: Occasion | null = null
    let result: EpisodeResult = null
    for (const e of events) {
      const o = e.kind === 'call' ? e.created : e.kind === 'system' ? e.occasion : undefined
      if (!o) continue
      occasion ??= o
      if (o.kind === 'rent') result = 'rent'
      else if (result !== 'rent' && !isLink(e)) result = 'reserve'
    }
    // Хто зараз має хід: остання подія клієнта після нашої останньої.
    let lastClient = -1
    let lastUs = -1
    events.forEach((e, i) => {
      if (fromClient(e)) lastClient = i
      if (fromUs(e)) lastUs = i
    })
    let waitingSince: Iso | null = null
    if (lastClient > lastUs) {
      // Перше повідомлення клієнта, на яке ще ніхто не відповів.
      let i = lastClient
      while (i - 1 > lastUs && fromClient(events[i - 1])) i--
      waitingSince = events[i].at
    }
    const closedByHand = last && t.closedAt && t.closedAt >= end
    const closed = !last || closedByHand || minutesBetween(end, now) > GAP_MIN
    const status: EpisodeStatus = closed ? 'closed' : waitingSince ? 'waiting_us' : lastUs >= 0 ? 'waiting_client' : 'open'
    let inherited = false
    if (!occasion && activeRent?.until && events[0].at <= activeRent.until) {
      occasion = activeRent
      result = 'rent'
      inherited = true
    }
    if (result === 'rent' && occasion && !inherited) activeRent = occasion
    if (closed && !result) result = 'none'
    const channels = [...new Set(events.flatMap((e) => (e.kind === 'msg' ? [e.channel] : [])))]
    return { index, events, start: events[0].at, end, occasion, status, result, waitingSince: closed ? null : waitingSince, channels, inherited }
  })
}

export const currentEpisode = (t: Thread, now: Iso) => {
  const eps = episodesOf(t, now)
  return eps[eps.length - 1] ?? null
}

/** Хвилини очікування нашої відповіді, або null. */
export const waitMin = (ep: Episode | null, now: Iso) => (ep?.waitingSince ? minutesBetween(ep.waitingSince, now) : null)

export const STATUS_LABEL: Record<EpisodeStatus, string> = {
  waiting_us: 'Чекає нашої відповіді',
  waiting_client: 'Чекає клієнта',
  open: 'Відкрите',
  closed: 'Закрите',
}

export const RESULT_LABEL: Record<Exclude<EpisodeResult, null>, string> = {
  rent: 'Оренда',
  reserve: 'Резерв',
  none: 'Без результату',
}

/**
 * AI-зведення звернення (пропозиція). У прототипі його складає правило, а не
 * модель: що просив — перше повідомлення або суть першого дзвінка клієнта;
 * що дали — остання наша відповідь; домовились — результат; далі — чий хід.
 */
export function episodeSummary(ep: Episode, override?: Summary, now?: Iso): Summary {
  if (override) return override
  const clip = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
  const firstAsk = ep.events.find((e) => (e.kind === 'msg' && e.from === 'client') || (e.kind === 'call' && e.summary))
  const asked = firstAsk ? (firstAsk.kind === 'msg' ? firstAsk.text : firstAsk.kind === 'call' ? firstAsk.summary ?? '' : '') : '—'
  const lastUs = [...ep.events].reverse().find((e) => e !== firstAsk && ((e.kind === 'msg' && (e.from === 'staff' || e.from === 'bot')) || (e.kind === 'call' && e.dir !== 'missed' && e.summary)))
  const given = lastUs ? (lastUs.kind === 'msg' ? lastUs.text : lastUs.kind === 'call' ? lastUs.summary ?? '' : '') : 'Ще нічого.'
  const agreed = ep.inherited && ep.occasion
    ? `У межах оренди ${ep.occasion.code}, що триває.`
    : ep.occasion && ep.result && ep.result !== 'none'
      ? `${RESULT_LABEL[ep.result]} ${ep.occasion.code}: ${ep.occasion.label}.`
      : ep.result === 'none'
        ? 'Нічого.'
        : '—'
  const next =
    ep.status === 'waiting_us'
      ? 'Відповісти клієнту.'
      : ep.status === 'waiting_client'
        ? 'Чекаємо відповіді клієнта.'
        : ep.status === 'closed'
          ? ep.result === 'none'
            ? 'Наступної дії немає.'
            : rentGoesOn(ep, now)
              ? `Оренда ${ep.occasion!.code} триває до ${ddmm(ep.occasion!.until!)}.`
              : 'Звернення закрите.'
          : '—'
  return { asked: clip(asked), given: clip(given), agreed, next }
}

/**
 * Варіант А — один тред без звернень. Увесь тред як одне «звернення», що
 * ніколи не закривається: статус — чий зараз хід, і тільки він.
 */
export function flatEpisode(t: Thread, now: Iso): Episode {
  const ev = t.events
  let lastClient = -1
  let lastUs = -1
  ev.forEach((e, i) => {
    if (fromClient(e)) lastClient = i
    if (fromUs(e)) lastUs = i
  })
  let waitingSince: Iso | null = null
  if (lastClient > lastUs) {
    let i = lastClient
    while (i - 1 > lastUs && fromClient(ev[i - 1])) i--
    waitingSince = ev[i].at
  }
  return {
    index: 0,
    events: ev,
    start: ev[0]?.at ?? now,
    end: ev[ev.length - 1]?.at ?? now,
    occasion: null,
    status: waitingSince ? 'waiting_us' : lastUs >= 0 ? 'waiting_client' : 'open',
    result: null,
    waitingSince,
    channels: [...new Set(ev.flatMap((e) => (e.kind === 'msg' ? [e.channel] : [])))],
    inherited: false,
  }
}

/** Події треду за останні `days` діб як одне «звернення» — для зведення за період (А). */
export function periodEpisode(t: Thread, now: Iso, days: number | null): Episode {
  const ev = days == null ? t.events : t.events.filter((e) => minutesBetween(e.at, now) <= days * 24 * 60)
  const base = flatEpisode({ ...t, events: ev.length ? ev : t.events.slice(-1) }, now)
  let occasion: Occasion | null = null
  let result: EpisodeResult = null
  for (const e of base.events) {
    const o = e.kind === 'call' ? e.created : e.kind === 'system' ? e.occasion : undefined
    if (o) {
      occasion = o
      result = o.kind === 'rent' ? 'rent' : result === 'rent' ? 'rent' : 'reserve'
    }
  }
  return { ...base, occasion, result }
}

const ddmm = (iso: Iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`

/** Звернення закрилось, а оренда, якої воно стосується, ще триває: справа не закінчена. */
export function rentGoesOn(ep: Episode, now?: Iso): boolean {
  return !!now && ep.status === 'closed' && ep.occasion?.kind === 'rent' && !!ep.occasion.until && ep.occasion.until > now
}
