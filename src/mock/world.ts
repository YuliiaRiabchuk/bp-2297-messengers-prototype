import type {
  AiSession,
  CallEvent,
  CallbackTask,
  Counterparty,
  MsgEvent,
  Staff,
  SystemEvent,
  Thread,
  ThreadEvent,
  World,
} from './types'

/**
 * Сцени §5 брифу як СТАН. `buildWorld(sceneId)` збирає світ, у якому сцена
 * вже стоїть: обрав у віджеті — екран у потрібному місці.
 *
 * Усі імена й телефони — заглушки (репа публічна). Співробітники — імена з
 * брифу з вигаданими прізвищами.
 */

export const TODAY = '2026-11-09'

/* ─── співробітники ─────────────────────────────────────────────────── */

export const STAFF: Staff[] = [
  { id: 'oksana', name: 'Оксана Мельник', team: 'Колл-центр', role: 'operator' },
  { id: 'karyna', name: 'Карина Бойко', team: 'Колл-центр', role: 'operator' },
  { id: 'alisa', name: 'Аліса Гнатюк', team: 'Центральний офіс', role: 'manager' },
  { id: 'alona', name: 'Альона Бондар', team: 'Центральний офіс', role: 'manager' },
  { id: 'denys', name: 'Денис Шевчук', team: 'Куренівка', role: 'manager' },
  { id: 'taranenko', name: 'Тараненко', team: 'Керівник', role: 'head' },
]

/** Хто перед екраном за роллю з віджета. */
export const ME_BY_ROLE = { operator: 'karyna', manager: 'alisa', head: 'taranenko' } as const

/* ─── дрібні будівельники ───────────────────────────────────────────── */

let seq = 0
const nid = (p: string) => `${p}${++seq}`

const at = (day: string, time: string) => `${day}T${time}`
const today = (time: string) => at(TODAY, time)

function call(
  when: string,
  dir: CallEvent['dir'],
  o: Partial<Omit<CallEvent, 'kind' | 'at' | 'dir'>> = {},
): CallEvent {
  return {
    id: nid('c'),
    kind: 'call',
    at: when,
    dir,
    talkSec: dir === 'missed' ? 0 : 95,
    waitSec: dir === 'missed' ? 34 : 6,
    operatorId: dir === 'missed' ? null : 'oksana',
    line: 'Лінія КЦ',
    ...o,
  }
}

function msg(when: string, channel: MsgEvent['channel'], from: MsgEvent['from'], text: string, o: Partial<MsgEvent> = {}): MsgEvent {
  return { id: nid('m'), kind: 'msg', at: when, channel, from, text, ...o }
}

function sys(when: string, text: string, o: Partial<SystemEvent> = {}): SystemEvent {
  return { id: nid('s'), kind: 'system', at: when, text, ...o }
}

const byTime = (a: ThreadEvent, b: ThreadEvent) => a.at.localeCompare(b.at)

function thread(t: Omit<Thread, 'id' | 'events'> & { id?: string; events: ThreadEvent[] }): Thread {
  return { ...t, id: t.id ?? nid('t'), events: [...t.events].sort(byTime) }
}

/* ─── фонові клієнти: журнал не буває порожнім ───────────────────────── */

const BG: Counterparty[] = [
  { id: 'bg1', name: 'Лисенко Андрій Іванович', kind: 'FL', phone: '+380 67 000 11 01' },
  { id: 'bg2', name: 'ТОВ «Будмонтаж-Плюс»', kind: 'UL', phone: '+380 44 000 22 02', managerId: 'alona' },
  { id: 'bg3', name: 'Ткач Олена Петрівна', kind: 'FL', phone: '+380 50 000 33 03', trust: 'reliable' },
  { id: 'bg4', name: 'Гуменюк Василь', kind: 'TEMP', phone: '+380 93 000 44 04' },
  { id: 'bg5', name: 'ФОП Савчук Р. М.', kind: 'UL', phone: '+380 97 000 55 05' },
  { id: 'bg6', name: 'Мороз Ігор Степанович', kind: 'FL', phone: '+380 63 000 66 06' },
]

function backgroundThreads(): Thread[] {
  return [
    thread({ counterpartyId: 'bg1', events: [call(today('08:47'), 'in', { talkSec: 132, purpose: 'Замовлення', summary: 'Перфоратор на 2 доби, Куренівка; створено резерв.', created: { kind: 'reserve', code: 'Р-3K9TA', label: 'Перфоратор Bosch GBH 2-26' } })] }),
    thread({ counterpartyId: 'bg2', events: [call(today('09:15'), 'out', { talkSec: 248, operatorId: 'karyna', purpose: 'Консультація', summary: 'Уточнили графік повернення риштувань.' })] }),
    thread({
      counterpartyId: 'bg3',
      takenBy: { staffId: 'karyna', at: today('10:22') },
      events: [
        call(today('09:58'), 'in', { talkSec: 61, operatorId: 'karyna', purpose: 'Консультація', summary: 'Питала про заставу на віброплиту.' }),
        msg(today('10:20'), 'telegram', 'client', 'Надішліть, будь ласка, фото віброплити, яку даєте.'),
        msg(today('10:31'), 'telegram', 'staff', 'Олено Петрівно, ось фото й характеристики: 90 кг, плита 50×60 см.', { staffId: 'karyna' }),
      ],
    }),
    thread({ counterpartyId: 'bg4', events: [call(today('11:20'), 'missed', { waitSec: 41 })] }),
    thread({ counterpartyId: 'bg5', events: [call(today('11:41'), 'in', { talkSec: 305, purpose: 'Замовлення', summary: 'Бетонозмішувач 160 л на тиждень, доставка завтра.', created: { kind: 'rent', code: 'А-7R2MC', label: 'Бетонозмішувач 160 л' } })] }),
    thread({
      counterpartyId: 'bg6',
      takenBy: { staffId: 'oksana', at: '2026-11-08T17:12' },
      events: [
        msg('2026-11-08T17:10', 'viber', 'client', 'Генератор не заводиться, що робити?'),
        msg('2026-11-08T17:25', 'viber', 'staff', 'Ігорю Степановичу, перевірте, будь ласка, кран подачі пального. Якщо не допоможе — привезіть, замінимо.', { staffId: 'oksana' }),
        call(today('12:32'), 'in', { talkSec: 44, operatorId: 'karyna', purpose: 'Скарга', summary: 'Не заводиться генератор, передали в сервіс.' }),
      ],
    }),
    thread({
      counterpartyId: null,
      handle: { channel: 'viber', value: '+380 99 000 31 31', name: 'Олег' },
      takenBy: { staffId: 'oksana', at: '2026-11-02T11:05' },
      events: [
        msg('2026-11-02T11:02', 'viber', 'client', 'Скільки коштує бетонозмішувач на два тижні?'),
        msg('2026-11-02T11:09', 'viber', 'staff', 'Бетонозмішувач 160 л — 280 грн/доба, на 14 діб — 3 400 грн зі знижкою.', { staffId: 'oksana' }),
      ],
    }),
    thread({
      counterpartyId: 'bg1',
      takenBy: { staffId: 'karyna', at: '2026-11-03T09:01' },
      events: [
        msg('2026-11-03T09:00', 'telegram', 'client', 'Чи є перфоратор на вихідні?'),
        msg('2026-11-03T09:06', 'telegram', 'staff', 'Так, Bosch GBH 2-26, 220 грн/доба. Резервую?', { staffId: 'karyna' }),
        msg('2026-11-03T09:11', 'telegram', 'client', 'Так'),
        call('2026-11-03T09:20', 'out', { operatorId: 'karyna', talkSec: 75, purpose: 'Замовлення', summary: 'Підтвердили перфоратор на вихідні.', created: { kind: 'reserve', code: 'Р-1HS4E', label: 'Перфоратор Bosch GBH 2-26' } }),
      ],
    }),
  ]
}

function backgroundTasks(): CallbackTask[] {
  return [
    {
      id: 'task-bg4',
      kind: 'callback',
      title: 'Передзвонити',
      counterpartyId: 'bg4',
      phone: '+380 93 000 44 04',
      source: 'Пропущений дзвінок',
      createdAt: today('11:20'),
      deadlineAt: today('11:35'),
      assigneeId: null,
      status: 'new',
      attempts: 1,
    },
  ]
}

const AI: AiSession[] = [
  { id: 'ai1', at: today('07:52'), durationSec: 128, phone: '+380 66 000 70 01', counterpartyId: null, equipment: 'Генератор 5 кВт', outcome: 'Заявка' },
  { id: 'ai2', at: today('08:03'), durationSec: 61, phone: '+380 67 000 11 01', counterpartyId: 'bg1', equipment: '—', outcome: 'Передзвонити' },
  { id: 'ai3', at: today('13:15'), durationSec: 203, phone: '+380 68 000 70 03', counterpartyId: null, equipment: 'Риштування рамні', outcome: 'Заявка' },
]

/* ─── сцени ─────────────────────────────────────────────────────────── */

const KOVAL: Counterparty = {
  id: 'cp-koval',
  name: 'Коваль Сергій Петрович',
  kind: 'FL',
  phone: '+380 67 000 14 08',
  trust: 'reliable',
  telegram: '@s_koval',
  viber: '+380 67 000 14 08',
}

type SceneBuild = Pick<World, 'now'> & {
  counterparties?: Counterparty[]
  threads: Thread[]
  tasks?: CallbackTask[]
  focus: World['focus']
}

const RESERVE_GEN = { kind: 'reserve' as const, code: 'Р-8M2DX', label: 'Генератор Honda EU22i' }

const SCENES: Record<string, () => SceneBuild> = {
  /* 1. Новий клієнт у Telegram: номера немає. */
  'tg-new': () => {
    const t = thread({
      id: 'th-new',
      counterpartyId: null,
      handle: { channel: 'telegram', value: '@bud_ivan', name: 'Іван' },
      events: [
        msg(today('11:58'), 'telegram', 'client', 'Добрий день. Потрібен генератор на 3 доби, з завтра. Є щось на 5 кВт?'),
      ],
    })
    return { now: today('12:01'), threads: [t], focus: { threadId: t.id, counterpartyId: null } }
  },

  /* 2. Клієнт з посилання в SMS: ?start=<резерв>. */
  'sms-link': () => {
    const t = thread({
      id: 'th-koval',
      counterpartyId: KOVAL.id,
      events: [
        call(today('09:31'), 'in', { talkSec: 188, purpose: 'Замовлення', summary: 'Генератор на 3 доби з 10.11, Куренівка.', created: RESERVE_GEN }),
        msg(today('09:40'), 'viber-notify', 'staff', 'Резерв Р-8M2DX: Генератор Honda EU22i, Куренівка, 10.11 з 9:00. Продовжити діалог у Telegram: t.me/budprokat_bot?start=R-8M2DX', { delivery: 'delivered', template: 'Резерв підтверджено' }),
        sys(today('13:02'), 'Клієнт перейшов за посиланням із повідомлення про резерв Р-8M2DX', { occasion: RESERVE_GEN }),
        msg(today('13:02'), 'telegram', 'client', 'Добрий день, а можна забрати не о 9, а о 8:30?'),
      ],
    })
    return { now: today('13:05'), counterparties: [KOVAL], threads: [t], focus: { threadId: t.id, counterpartyId: KOVAL.id } }
  },

  /* 3. Змішаний день: дзвінок 10:12, Telegram 12:05, дзвінок 13:40, дзвінок 15:34. */
  'mixed-day': () => {
    const t = thread({
      id: 'th-koval',
      counterpartyId: KOVAL.id,
      events: [
        call(today('10:12'), 'in', { talkSec: 142, purpose: 'Консультація', summary: 'Питав ціну віброплити на тиждень і доставку в Ірпінь.', transcript: 'Клієнт: Скільки коштує віброплита на тиждень?… Оператор: 650 грн за добу, застава 8 000…' }),
        msg(today('12:05'), 'telegram', 'client', 'Надішліть, будь ласка, адресу Куренівки, під\'їду подивитись.'),
        call(today('13:40'), 'missed', { waitSec: 52 }),
        call(today('15:34'), 'in', { talkSec: 97, operatorId: 'karyna', purpose: 'Консультація', summary: 'Перепитує адресу відділення: на повідомлення в Telegram не відповіли.' }),
      ],
    })
    // Пропущений 13:40 створив «Передзвонити»; вхідний 15:34 закрив її автозвʼязкою.
    const task: CallbackTask = { id: 'task-mixed', kind: 'callback', title: 'Передзвонити', counterpartyId: KOVAL.id, phone: KOVAL.phone, source: 'Пропущений дзвінок', createdAt: today('13:40'), deadlineAt: today('13:55'), assigneeId: 'karyna', status: 'done', attempts: 1 }
    return { now: today('15:37'), counterparties: [KOVAL], threads: [t], tasks: [task], focus: { threadId: t.id, counterpartyId: KOVAL.id } }
  },

  /* 4. Двоє операторів: А (Оксана) взяла, Б (Карина) бачить «взято». */
  'two-operators': () => {
    const t = thread({
      id: 'th-two',
      counterpartyId: null,
      handle: { channel: 'viber', value: '+380 95 000 21 77', name: 'Марина' },
      takenBy: { staffId: 'oksana', at: today('10:44') },
      events: [
        msg(today('10:41'), 'viber', 'client', 'Доброго дня! Чи є в оренду мийка високого тиску?'),
        msg(today('10:46'), 'viber', 'staff', 'Доброго дня, Марино! Так, Kärcher K5 — 350 грн/доба. На коли потрібна?', { staffId: 'oksana' }),
      ],
    })
    return { now: today('10:49'), threads: [t], focus: { threadId: t.id, counterpartyId: null } }
  },

  /* 5. Ніхто не відповів: написав о 18:40, зараз 19:05. */
  'no-reply': () => {
    const cp: Counterparty = { id: 'cp-pavl', name: 'Павленко Дмитро', kind: 'FL', phone: '+380 50 000 47 12', telegram: '@d_pavlenko' }
    const t = thread({
      id: 'th-pavl',
      counterpartyId: cp.id,
      events: [
        call('2026-10-21T14:10', 'in', { talkSec: 76, purpose: 'Замовлення', summary: 'Болгарка на 2 доби, Куренівка.', created: { kind: 'rent', code: 'А-6BG2K', label: 'Болгарка Makita GA9020' } }),
        msg(today('18:40'), 'telegram', 'client', 'Добрий вечір. Завтра зранку потрібен відбійний молоток, на 2 доби. Встигну забрати о 8?'),
      ],
    })
    return { now: today('19:05'), counterparties: [cp], threads: [t], focus: { threadId: t.id, counterpartyId: cp.id } }
  },

  /* 6. Постійний клієнт ЮЛ: два роки, 40 дзвінків, 15 діалогів. */
  'regular-ul': () => {
    const cp: Counterparty = {
      id: 'cp-ul',
      name: 'ТОВ «Міськбуд-Сервіс»',
      kind: 'UL',
      phone: '+380 44 000 90 10',
      trust: 'reliable',
      managerId: 'alisa',
      telegram: '@mbs_postach',
      viber: '+380 67 000 90 11',
    }
    const t = thread({ id: 'th-ul', counterpartyId: cp.id, events: regularHistory() })
    return { now: today('11:20'), counterparties: [cp], threads: [t], focus: { threadId: t.id, counterpartyId: cp.id } }
  },

  /* 7. Втрачений клієнт: отримав ціну і зник. */
  'lost': () => {
    const cp: Counterparty = { id: 'cp-lost', name: 'Руденко Тарас', kind: 'TEMP', phone: '+380 66 000 52 30', viber: '+380 66 000 52 30' }
    const t = thread({
      id: 'th-lost',
      counterpartyId: cp.id,
      events: [
        msg('2026-11-03T18:05', 'viber', 'client', 'Скільки коштує віброплита на тиждень? І чи возите в Ірпінь?'),
        msg('2026-11-04T08:40', 'viber', 'staff', 'Віброплита 90 кг — 650 грн/доба, застава 8 000 грн. Доставка в Ірпінь — 900 грн в один бік.', { staffId: 'oksana' }),
        msg('2026-11-04T09:01', 'viber', 'client', 'Дякую, подумаю'),
      ],
    })
    return { now: today('10:00'), counterparties: [cp], threads: [t], focus: { threadId: t.id, counterpartyId: cp.id } }
  },

  /* 8. Два канали одночасно: Viber і Telegram в один тред. */
  'two-channels': () => {
    const t = thread({
      id: 'th-koval',
      counterpartyId: KOVAL.id,
      events: [
        msg(today('14:02'), 'viber', 'client', 'Добрий день, ще є генератор на завтра?'),
        msg(today('14:06'), 'telegram', 'client', 'Дублюю сюди: генератор на завтра, 3 доби, Куренівка'),
        msg(today('14:09'), 'viber', 'client', 'Алло?'),
      ],
    })
    return { now: today('14:12'), counterparties: [KOVAL], threads: [t], focus: { threadId: t.id, counterpartyId: KOVAL.id } }
  },

  /* 9. Чат Софії з сайту: номер → задача «Передзвонити» (BP-2294). */
  'sofia': () => {
    const cp: Counterparty = { id: 'cp-sofia', name: 'Клієнт +380 68 000 61 15', kind: 'TEMP', phone: '+380 68 000 61 15' }
    const m1 = msg('2026-11-08T22:10', 'site', 'client', 'Доброго вечора, є риштування на 40 квадратів?')
    const t = thread({
      id: 'th-sofia',
      counterpartyId: cp.id,
      events: [
        m1,
        msg('2026-11-08T22:11', 'site', 'bot', 'Доброго вечора! Так, рамні риштування є. Секція 2×1 м — 25 грн/доба. Залиште номер, менеджер порахує комплект.'),
        msg('2026-11-08T22:16', 'site', 'client', '0680006115'),
        sys('2026-11-08T22:16', 'Софія створила задачу «Передзвонити»'),
      ],
    })
    const task: CallbackTask = {
      id: 'task-sofia',
      kind: 'callback',
      title: 'Передзвонити',
      counterpartyId: cp.id,
      phone: cp.phone,
      source: 'Чат на сайті — Софія',
      createdAt: '2026-11-08T22:16',
      deadlineAt: today('08:15'),
      assigneeId: null,
      status: 'new',
      attempts: 0,
      originEventId: m1.id,
      comment: 'Риштування рамні на 40 м², просить порахувати комплект.',
    }
    return { now: today('09:05'), counterparties: [cp], threads: [t], tasks: [task], focus: { threadId: t.id, counterpartyId: cp.id } }
  },

  /* 10. SMS після дзвінка: оператор пише з колонки «Чат з клієнтом». */
  'sms-after-call': () => {
    const cp: Counterparty = { id: 'cp-sms', name: 'Литвин Оксана Василівна', kind: 'FL', phone: '+380 97 000 38 44' }
    const t = thread({
      id: 'th-sms',
      counterpartyId: cp.id,
      aiDraft: 'Оксано Василівно, ваш резерв Р-5W1PK: плиткоріз Sigma 3B4, Позняки, вул. Заглушкова, 1, 11.11 з 9:00. З собою паспорт. Будпрокат',
      events: [
        call(today('14:20'), 'in', {
          talkSec: 214,
          operatorId: 'karyna',
          purpose: 'Замовлення',
          summary: 'Плиткоріз на 2 доби з 11.11. Хоче адресу Позняків і перелік документів.',
          created: { kind: 'reserve', code: 'Р-5W1PK', label: 'Плиткоріз Sigma 3B4' },
        }),
      ],
    })
    return { now: today('14:25'), counterparties: [cp], threads: [t], focus: { threadId: t.id, counterpartyId: cp.id } }
  },

  /* 11. Порожньо: клієнт ніколи не писав. */
  'empty': () => {
    const cp: Counterparty = { id: 'cp-empty', name: 'Бондаренко Віктор', kind: 'FL', phone: '+380 63 000 77 21' }
    const t = thread({ id: 'th-empty', counterpartyId: cp.id, events: [call('2026-10-30T16:02', 'in', { talkSec: 58, purpose: 'Консультація', summary: 'Питав про графік роботи.' })] })
    return { now: today('12:00'), counterparties: [cp], threads: [t], focus: { threadId: t.id, counterpartyId: cp.id } }
  },

  /* ── крайні стани §6 ── */

  'edge-500': () => {
    const events: ThreadEvent[] = []
    for (let i = 0; i < 500; i++) {
      const d = new Date(2026, 9, 1 + Math.floor(i / 13), 8 + (i % 10), (i * 7) % 60)
      const when = isoOf(d)
      events.push(msg(when, i % 3 ? 'telegram' : 'viber', i % 2 ? 'client' : 'staff', i % 2 ? `Повідомлення клієнта № ${i + 1}` : `Відповідь № ${i + 1}`, i % 2 ? {} : { staffId: 'oksana' }))
    }
    const t = thread({ id: 'th-500', counterpartyId: KOVAL.id, events })
    return { now: today('12:00'), counterparties: [KOVAL], threads: [t], focus: { threadId: t.id, counterpartyId: KOVAL.id } }
  },

  'edge-long': () => {
    const t = thread({
      id: 'th-long',
      counterpartyId: KOVAL.id,
      events: [
        msg(today('11:10'), 'telegram', 'client', 'https://budprokat.ua/catalog/generatory/benzynovi/honda-eu22i-invertornyi-2-2-kvt?utm_source=telegram&utm_medium=bot&utm_campaign=reserve_R-8M2DX_reminder_ref_00000000000000000000'),
        msg(today('11:11'), 'telegram', 'client', 'ААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААААА'),
      ],
    })
    return { now: today('11:15'), counterparties: [KOVAL], threads: [t], focus: { threadId: t.id, counterpartyId: KOVAL.id } }
  },

  'edge-no-cp': () => SCENES['tg-new'](),

  'edge-taken': () => SCENES['two-operators'](),

  'edge-bot-down': () => {
    const b = SCENES['no-reply']()
    b.threads[0].botDown = true
    return b
  },

  'edge-sms-fail': () => {
    const b = SCENES['sms-after-call']()
    b.threads[0].events.push(
      msg(today('14:24'), 'sms', 'staff', 'Оксано Василівно, резерв Р-5W1PK: плиткоріз, Позняки, вул. Заглушкова, 1, 11.11 з 9:00. Документ: паспорт.', {
        staffId: 'karyna',
        delivery: 'failed',
        template: 'Після дзвінка',
      }),
    )
    return b
  },
}

/* ─── два роки постійного ЮЛ ────────────────────────────────────────── */

function isoOf(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function regularHistory(): ThreadEvent[] {
  const ev: ThreadEvent[] = []
  const managers = ['alisa', 'alisa', 'alona', 'oksana']
  const topics = [
    ['Риштування рамні на об\'єкт', 'Замовлення'],
    ['Продовження оренди риштувань', 'Консультація'],
    ['Рахунок і акт за жовтень', 'Консультація'],
    ['Бетонозмішувач на тиждень', 'Замовлення'],
    ['Доставка на Оболонь', 'Консультація'],
  ]
  // 37 дзвінків рівномірно за два роки до жовтня 2026.
  for (let i = 0; i < 37; i++) {
    const d = new Date(2024, 10, 12 + i * 19, 9 + (i % 7), (i * 13) % 60)
    const [summary, purpose] = topics[i % topics.length]
    ev.push(call(isoOf(d), i % 9 === 4 ? 'missed' : i % 4 === 0 ? 'out' : 'in', i % 9 === 4 ? {} : { talkSec: 60 + (i * 37) % 300, operatorId: managers[i % managers.length], purpose, summary }))
  }
  // 13 діалогів у месенджерах до жовтня 2026.
  for (let i = 0; i < 13; i++) {
    const d = new Date(2024, 11, 3 + i * 49, 10 + (i % 6), (i * 17) % 60)
    const ch = i % 2 ? 'viber' : 'telegram'
    ev.push(msg(isoOf(d), ch, 'client', i % 3 ? 'Добрий день, потрібен рахунок на продовження.' : 'Скиньте, будь ласка, акт звірки.'))
    ev.push(msg(isoOf(new Date(d.getTime() + 22 * 60000)), ch, 'staff', 'Добрий день! Надіслали на пошту.', { staffId: 'alisa' }))
  }
  // Останній місяць: ціна → резерв → оренда → продовження, і зараз чекаємо клієнта.
  const SCAF_RES = { kind: 'reserve' as const, code: 'Р-2QX8N', label: 'Риштування рамні 120 м²' }
  const SCAF_RENT = { kind: 'rent' as const, code: 'А-9PL3D', label: 'Риштування рамні 120 м²' }
  ev.push(
    call('2026-10-13T10:05', 'in', { operatorId: 'alisa', talkSec: 312, purpose: 'Замовлення', summary: 'Риштування 120 м² на ЖК на Оболоні з 20.10, просять ціну з доставкою.' }),
    msg('2026-10-13T11:30', 'telegram', 'staff', 'Комплект 120 м²: 2 980 грн/доба, доставка й монтаж 4 500 грн. Рахунок надішлю після підтвердження.', { staffId: 'alisa' }),
    msg('2026-10-14T09:12', 'telegram', 'client', 'Погоджено, ставте на 20.10.'),
    call('2026-10-14T09:40', 'out', { operatorId: 'alisa', talkSec: 140, purpose: 'Замовлення', summary: 'Підтвердили дату й адресу, створено резерв.', created: SCAF_RES }),
    sys('2026-10-20T08:10', 'Резерв Р-2QX8N перетворено на оренду А-9PL3D', { occasion: SCAF_RENT }),
    call('2026-10-27T15:22', 'in', { operatorId: 'alisa', talkSec: 95, purpose: 'Консультація', summary: 'Просять продовжити на 2 тижні, до 17.11.' }),
    msg('2026-10-27T15:40', 'viber', 'staff', 'Продовження до 17.11 — рахунок № 1186 на 41 720 грн.', { staffId: 'alisa' }),
    msg('2026-11-05T16:02', 'viber', 'client', 'Рахунок оплатимо в понеділок.'),
    msg('2026-11-06T09:00', 'viber-notify', 'staff', 'Нагадування: оплата рахунку № 1186 до 07.11.', { delivery: 'delivered', template: 'Нагадування про оплату' }),
  )
  return ev
}

/* ─── збірка ────────────────────────────────────────────────────────── */

export function buildWorld(sceneId: string): World {
  seq = 0
  const s = (SCENES[sceneId] ?? SCENES['tg-new'])()
  const summaries: Record<string, World['threads'][number]['summary']> = {
    'th-ul': {
      asked: 'Риштування 120 м² на ЖК на Оболоні, потім продовження на 2 тижні.',
      given: 'Ціна 2 980 грн/доба + доставка 4 500; рахунок № 1186 на продовження до 17.11.',
      agreed: 'Оренда А-9PL3D до 17.11; оплату обіцяли в понеділок, 09.11.',
      next: 'Перевірити оплату № 1186 сьогодні; 17.11 — повернення або нове продовження.',
    },
    'th-lost': {
      asked: 'Ціна віброплити на тиждень і доставка в Ірпінь.',
      given: '650 грн/доба, застава 8 000, доставка 900 грн.',
      agreed: 'Нічого: клієнт «подумаю».',
      next: 'Наступної дії немає.',
    },
  }
  return {
    now: s.now,
    staff: STAFF,
    counterparties: [...BG, ...(s.counterparties ?? [])],
    // Фон зібраний на весь день; події пізніші за «зараз» сцени відкидаються.
    threads: [...backgroundThreads().map((t) => ({ ...t, events: t.events.filter((e) => e.at <= s.now) })).filter((t) => t.events.length), ...s.threads].map((t) => ({
      ...t,
      takenBy: t.takenBy && t.takenBy.at <= s.now ? t.takenBy : undefined,
      summary: t.summary ?? summaries[t.id],
    })),
    tasks: [...backgroundTasks().filter((t) => t.createdAt <= s.now), ...(s.tasks ?? [])],
    aiSessions: AI,
    focus: s.focus,
  }
}
