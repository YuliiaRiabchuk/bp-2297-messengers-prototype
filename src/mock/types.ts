/**
 * Модель даних прототипу. Одна на всі варіанти: варіанти різняться показом,
 * а не даними. Час — локальний рядок `YYYY-MM-DDTHH:MM` (без зони: прототип
 * живе в одному дні одного офісу).
 */

export type Iso = string

/** Канал повідомлення. `viber-notify` — одностороннє сповіщення TurboSMS (BP-1803), не чат-бот. */
export type MsgChannel = 'telegram' | 'viber' | 'whatsapp' | 'site' | 'sms' | 'viber-notify'

export type Delivery = 'delivered' | 'queued' | 'failed'

export interface Staff {
  id: string
  name: string
  /** Підпис під іменем: команда або відділення. */
  team: string
  role: 'operator' | 'manager' | 'head'
}

export interface Counterparty {
  id: string
  /** Повна назва (ПІБ або назва ЮО). */
  name: string
  kind: 'FL' | 'UL' | 'TEMP'
  phone: string | null
  /** Статус довіри з довідника (прод: «Благонадійний» тощо). */
  trust?: 'reliable' | 'risky' | null
  /** Відповідальний менеджер. */
  managerId?: string
  /** Хендли клієнта в месенджерах. */
  telegram?: string
  viber?: string
}

/** `until` — кінець строку оренди (з урахуванням продовжень), як його знає прод. */
export type Occasion = { kind: 'reserve' | 'rent'; code: string; label: string; until?: Iso }

interface EventBase {
  id: string
  at: Iso
}

export interface CallEvent extends EventBase {
  kind: 'call'
  dir: 'in' | 'out' | 'missed'
  /** Чиста розмова, с; 0 для пропущеного. */
  talkSec: number
  waitSec: number
  operatorId: string | null
  /** Куди дзвонив (лінія / відділення). */
  line: string
  purpose?: string
  summary?: string
  /** Обладнання, про яке говорили (з транскрипції). */
  equipment?: string[]
  transcript?: string
  /** Резерв/оренда, створені за цим дзвінком. */
  created?: Occasion
}

export interface MsgEvent extends EventBase {
  kind: 'msg'
  channel: MsgChannel
  from: 'client' | 'staff' | 'bot'
  staffId?: string
  text: string
  /** Тільки для вихідних SMS / Viber-сповіщень. */
  delivery?: Delivery
  /** Шаблон вихідного SMS. */
  template?: string
}

export interface SystemEvent extends EventBase {
  kind: 'system'
  text: string
  occasion?: Occasion
}

export type ThreadEvent = CallEvent | MsgEvent | SystemEvent

/** AI-зведення: що просив, що дали, про що домовились, наступна дія (§3 брифу). */
export interface Summary {
  asked: string
  given: string
  agreed: string
  next: string
}

/**
 * Тред — уся комунікація одного клієнта. Клієнт без контрагента (написав у
 * бот, номера немає) має тред з `counterpartyId: null` і хендлом.
 */
export interface Thread {
  id: string
  counterpartyId: string | null
  /** Як клієнт видний у каналі, коли контрагента немає. */
  handle?: { channel: MsgChannel; value: string; name?: string }
  events: ThreadEvent[]
  /** Хто взяв тред у пулі (правило «хто перший»). */
  takenBy?: { staffId: string; at: Iso }
  /** Зведення по треду (варіант 0б малює його за діалогом). */
  summary?: Summary
  /** Бот каналу недоступний (крайній стан). */
  botDown?: boolean
  /** Оператор закрив поточне звернення вручну (варіант Б). */
  closedAt?: Iso
  /** AI-підказка тексту SMS після дзвінка (BP-2301). */
  aiDraft?: string
}

export interface CallbackTask {
  id: string
  kind: 'callback'
  title: string
  counterpartyId: string | null
  phone: string | null
  /** Джерело заявки зі справочника спеки. */
  source: string
  createdAt: Iso
  deadlineAt: Iso
  assigneeId: string | null
  status: 'new' | 'in_progress' | 'done'
  attempts: number
  /** Подія, з якої задача народилась (дзвінок або чат Софії). */
  originEventId?: string
  comment?: string
}

export interface AiSession {
  id: string
  at: Iso
  durationSec: number
  phone: string
  counterpartyId: string | null
  equipment: string
  outcome: string
}

export interface World {
  now: Iso
  staff: Staff[]
  counterparties: Counterparty[]
  threads: Thread[]
  tasks: CallbackTask[]
  aiSessions: AiSession[]
  /** Головний клієнт сцени: туди ведуть точки входу. */
  focus: { threadId: string | null; counterpartyId: string | null }
}
