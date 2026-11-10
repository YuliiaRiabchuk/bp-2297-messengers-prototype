/**
 * Одинадцять сцен §5 брифу і крайні стани §6 як перелік. Стан кожної сцени
 * (дані-заглушки) зʼявляється в `src/mock` на етапі 3; тут лише назва і що
 * сцена має довести.
 *
 * Сцена живе НАД варіантами: той самий стан для всіх варіантів.
 */
export type Entry = 'pool' | 'journal' | 'card' | 'tasks'

export interface Scene {
  id: string
  n: string
  title: string
  /** Що ця сцена має довести. */
  proves: string
  /** Де сцена починається: варіант сам вирішує, що це за екран у нього. */
  entry: Entry
  /** Крайній стан (§6 брифу), а не сцена §5: у прогоні сцен не бере участі. */
  edge?: true
}

export const SCENES: Scene[] = [
  { id: 'tg-new', entry: 'pool', n: '1', title: 'Новий клієнт у Telegram', proves: '«Потрібен генератор на 3 доби», номера немає: звернення в пулі, оператор бере, просить контакт, створює або привʼязує контрагента' },
  { id: 'sms-link', entry: 'pool', n: '2', title: 'Клієнт з посилання в SMS', proves: 'прийшов у бот із ?start=<резерв>: тред одразу привʼязаний до резерву і контрагента' },
  { id: 'mixed-day', entry: 'journal', n: '3', title: 'Змішаний день', proves: 'дзвінок 10:12, Telegram 12:05, дзвінок 13:40, дзвінок 15:34: чотири записи в такому порядку, 15:34 — 4-те звернення за день (BP-2300)' },
  { id: 'two-operators', entry: 'pool', n: '4', title: 'Двоє операторів', proves: 'оператор А взяв звернення, в оператора Б воно взяте, з імʼям А' },
  { id: 'no-reply', entry: 'pool', n: '5', title: 'Ніхто не відповів', proves: 'клієнт написав о 18:40, минуло 25 хвилин: звернення підсвічене в пулі й потрапляє в «Пропущені»' },
  { id: 'regular-ul', entry: 'card', n: '6', title: 'Постійний клієнт ЮЛ', proves: 'два роки історії, 40 дзвінків, 15 діалогів: керівник за секунду бачить останній місяць і де клієнт зараз' },
  { id: 'lost', entry: 'pool', n: '7', title: 'Втрачений клієнт', proves: 'отримав ціну і зник: звернення закрилось без результату і видно у фільтрі' },
  { id: 'two-channels', entry: 'pool', n: '8', title: 'Два канали одночасно', proves: 'клієнт пише у Viber і в Telegram: обидва в одному треді' },
  { id: 'sofia', entry: 'tasks', n: '9', title: 'Чат Софії з сайту', proves: 'клієнт назвав номер, створилась задача «Перезвонити»; чат видно в треді (пропозиція)' },
  { id: 'sms-after-call', entry: 'journal', n: '10', title: 'SMS після дзвінка', proves: 'з колонки «Чат з клієнтом» AI-підказка → правка → SMS; у треді статус доставки, поля відповіді немає' },
  { id: 'empty', entry: 'card', n: '11', title: 'Порожньо', proves: 'клієнт ніколи не писав' },
  { id: 'edge-500', entry: 'card', n: '500', title: '500 повідомлень', proves: 'тред на 500 повідомлень', edge: true },
  { id: 'edge-long', entry: 'pool', n: 'ww', title: 'Довге без пробілів', proves: 'довге повідомлення без пробілів', edge: true },
  { id: 'edge-no-cp', entry: 'pool', n: 'нк', title: 'Без контрагента', proves: 'клієнт без контрагента', edge: true },
  { id: 'edge-taken', entry: 'pool', n: 'вз', title: 'Взяв інший', proves: 'звернення взяв інший оператор', edge: true },
  { id: 'edge-bot-down', entry: 'pool', n: 'бот', title: 'Бот недоступний', proves: 'бот недоступний', edge: true },
  { id: 'edge-sms-fail', entry: 'card', n: 'sms', title: 'SMS не доставлено', proves: 'SMS не доставлено', edge: true },
]

export const SCENE_BY_ID = new Map<string, Scene>(SCENES.map((s) => [s.id, s]))
