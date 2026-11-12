/**
 * Прогін прототипу BP-2297: 11 сцен §5 брифу × варіанти, виміри §6.
 *
 * Варіант не має окремого драйвера: скрипт ходить за КОНТРАКТОМ data-атрибутів,
 * який кожен варіант або виконує, або ні. Чого немає — того варіант не вміє,
 * і вимір пишеться як «—». Результат перевіряється за станом стору
 * (`window.__bp.world`), а не за картинкою.
 *
 * Контракт:
 *   [data-pool-row][data-thread=<id>]   рядок пулу «Месенджерів»
 *   [data-take]                          «Взяти»
 *   [data-reply-field]                   поле відповіді (textarea)
 *   [data-send]                          «Надіслати»
 *   [data-taken-by]                      «взято» з іменем виконавця
 *   [data-overdue]                       підсвічене «без відповіді»
 *   [data-missed-msg]                    рядок повідомлення в «Пропущених»
 *   [data-answer-month]                  відповідь «що було за місяць і чим закінчилось»
 *   [data-walk-month]                    кроки до неї (клікаються по черзі)
 *   [data-walk-lost]                     кроки до списку втрачених
 *   [data-lost-list] [data-thread]       список втрачених звернень
 *   [data-thread-item][data-at]          запис у треді (подія в порядку часу)
 *   [data-contact-count]                 лічильник BP-2300 у рядку журналу
 *   [data-chat-component=<ім'я>]         компонент листування (рахуються різні)
 *   [data-chat-cell]                     клітинка «Чат з клієнтом» (BP-2301)
 *   [data-ai-draft]                      AI-підказка тексту SMS
 *   [data-delivery]                      статус доставки SMS у треді
 *   [data-empty-chat]                    порожній стан листування
 *
 * Запуск (при `npm run dev`):
 *   node scripts/walk.mjs [--variants 0,0б,А,Б,В] [--card widget|history|tabs] [--url …] [--json out.json] [--shots]
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync, writeFileSync } from 'node:fs'

const argOf = (flag, fallback) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const BASE = argOf('--url', 'http://localhost:5173/bp-2297-messengers-prototype/')
const CHROME = argOf(
  '--chrome',
  process.env.CHROME_PATH ??
    (process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : process.platform === 'win32'
        ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
        : '/usr/bin/google-chrome'),
)
const VARIANTS = argOf('--variants', '0,0б,А,Б,В').split(',')
const JSON_OUT = argOf('--json', null)
/** Положення листування в картці (Q3): widget | history | tabs. */
const CARD = argOf('--card', 'widget')
const SHOTS = process.argv.includes('--shots')
const W = 1280
const H = 720

const SCENES = ['tg-new', 'sms-link', 'mixed-day', 'two-operators', 'no-reply', 'regular-ul', 'lost', 'two-channels', 'sofia', 'sms-after-call', 'empty']
const EDGES = ['edge-500', 'edge-long', 'edge-no-cp', 'edge-taken', 'edge-bot-down', 'edge-sms-fail']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', defaultViewport: { width: W, height: H } })
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))

async function open(v, scene, role = 'operator', extra = {}) {
  const q = new URLSearchParams({ v, scene, role, lab: 'off', card: CARD, ...extra })
  await page.goto(`${BASE}?${q}`, { waitUntil: 'networkidle0' })
  await sleep(150)
}

const world = () => page.evaluate(() => window.__bp.world)
/** Картка з вкладками (Q3): листування за вкладкою «Комунікації» — клікнути її. */
async function openComms() {
  const tab = await page.$('[role=tab][data-walk-month]')
  if (tab) {
    await tab.click()
    await sleep(150)
  }
}
const has = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].some((el) => el.getClientRects().length > 0), sel)

/** Позиція поля відповіді у координатах вмісту + чи видно його без прокрутки. */
const replyGeom = () =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll('[data-reply-field]')].find((e) => e.getClientRects().length)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), visible: r.top >= 0 && r.bottom <= window.innerHeight }
  })

const hscroll = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
const chatComponents = () => page.evaluate(() => [...document.querySelectorAll('[data-chat-component]')].map((e) => e.getAttribute('data-chat-component')))

class Run {
  constructor() {
    this.clicks = 0
    this.reply = []
  }
  async click(sel) {
    const el = await page.$(sel)
    if (!el) return false
    await el.click()
    this.clicks++
    await sleep(150)
    const g = await replyGeom()
    if (g) this.reply.push(g.top)
    return true
  }
  async clickAll(sel, until) {
    for (let i = 0; i < 6; i++) {
      if (await has(until)) return true
      const els = await page.$$(sel)
      const next = els[i]
      if (!next) break
      await next.click()
      this.clicks++
      await sleep(150)
    }
    return has(until)
  }
  shift() {
    if (this.reply.length < 2) return this.reply.length ? 0 : null
    let max = 0
    for (let i = 1; i < this.reply.length; i++) max = Math.max(max, Math.abs(this.reply[i] - this.reply[i - 1]))
    return max
  }
}

/** Сцени 1 і 5: від нового повідомлення в пулі до надісланої відповіді. */
async function poolToReply(v, scene) {
  await open(v, scene)
  const w = await world()
  const tid = w.focus.threadId
  const run = new Run()
  if (!(await run.click(`[data-pool-row][data-thread="${tid}"]`))) return { clicks: null, ok: false, note: 'пулу немає' }
  // Д, Е: поле з'являється після «Взяти діалог» (як у Ringostat) — це окремий клік.
  if (!(await has('[data-reply-field]')) && (await has('[data-take]'))) await run.click('[data-take]')
  const field = await page.$('[data-reply-field]')
  if (!field) return { clicks: null, ok: false, note: 'поля відповіді немає' }
  await field.type('Добрий день! Так, є. Поділіться, будь ласка, номером.')
  // «Взяти» — тільки якщо варіант без нього не дає надіслати.
  if ((await has('[data-send][disabled]')) && (await has('[data-take]'))) await run.click('[data-take]')
  await run.click('[data-send]')
  const after = await world()
  const t = after.threads.find((x) => x.id === tid)
  const last = t.events[t.events.length - 1]
  return { clicks: run.clicks, ok: last.kind === 'msg' && last.from === 'staff', shift: run.shift() }
}

/** Сцени 1 і 5 клавіатурою: ↓/Enter у пулі, Т — взяти, Enter — надіслати. */
async function keyboard(v, scene) {
  await open(v, scene)
  const w = await world()
  if (!(await has('[data-pool-row]'))) return null
  await page.focus('[data-pool-row]')
  await page.keyboard.press('Enter')
  await sleep(150)
  await page.keyboard.press('KeyT')
  await sleep(100)
  await page.keyboard.type('Добрий вечір! Так, встигнете.')
  await page.keyboard.press('Enter')
  await sleep(150)
  const t = (await world()).threads.find((x) => x.id === w.focus.threadId)
  const last = t.events[t.events.length - 1]
  return last.kind === 'msg' && last.from === 'staff'
}

async function monthAnswer(v) {
  await open(v, 'regular-ul', 'head')
  const run = new Run()
  const ok = await run.clickAll('[data-walk-month]', '[data-answer-month]')
  return ok ? run.clicks : null
}

async function lostList(v) {
  await open(v, 'lost')
  const run = new Run()
  const ok = await run.clickAll('[data-walk-lost]', '[data-lost-list]')
  if (!ok) return null
  const w = await world()
  return (await has(`[data-lost-list] [data-thread="${w.focus.threadId}"]`)) ? run.clicks : null
}

/** Записи сцени 3 в треді в порядку 10:12 → 12:05 → 13:40 → 15:34. */
async function mixedDayOrder(v) {
  await open(v, 'mixed-day', 'operator', { p: 'cp:cp-koval' })
  await openComms()
  const times = await page.evaluate(() => {
    const thread = [...document.querySelectorAll('[data-thread-item]')].map((e) => e.getAttribute('data-at')?.slice(11))
    if (thread.length) return { from: 'тред', times: thread }
    const hist = [...document.querySelectorAll('[data-history-line]')].map((e) => e.querySelector('span:nth-child(2)')?.textContent)
    return { from: 'історія', times: hist }
  })
  const want = ['10:12', '12:05', '13:40', '15:34']
  const seen = times.times.filter((t) => want.includes(t))
  const ordered = [...seen].sort()
  const sameOrder = seen.length === 4 && (seen.join() === ordered.join() || seen.join() === [...ordered].reverse().join())
  await open(v, 'mixed-day', 'operator', { p: 'calls:all' })
  const counter = await page.evaluate(() => document.querySelector('[data-call-time="15:34"] [data-contact-count]')?.textContent?.trim() ?? null)
  return { all4: sameOrder, from: times.from, counter }
}

async function sceneChecks(v) {
  const res = {}
  // 2: тред одразу прив'язаний до резерву.
  await open(v, 'sms-link', 'operator', { p: 'cp:cp-koval' })
  await openComms()
  res[2] = await page.evaluate(() => document.body.innerText.includes('о 8:30'))
  // 4: у Б звернення взяте, з ім'ям А.
  await open(v, 'two-operators')
  res[4] = await page.evaluate(() => [...document.querySelectorAll('[data-taken-by]')].some((e) => e.textContent.includes('Оксана')))
  // 5: підсвічене в пулі й потрапляє в «Пропущені».
  await open(v, 'no-reply')
  const hl = await has('[data-overdue]')
  await open(v, 'no-reply', 'operator', { p: 'calls:missed' })
  res[5] = hl && (await has('[data-missed-msg]'))
  // 8: Viber і Telegram — в одному компоненті треду.
  await open(v, 'two-channels', 'operator', { p: 'cp:cp-koval' })
  await openComms()
  res[8] = await page.evaluate(() => {
    const items = [...document.querySelectorAll('[data-thread-item][data-channel]')]
    const ch = new Set(items.map((e) => e.getAttribute('data-channel')))
    return ch.has('viber') && ch.has('telegram')
  })
  // 9: чат Софії видно з задачі «Передзвонити».
  await open(v, 'sofia', 'operator', { p: 'mytasks', d: 'task:task-sofia' })
  if (await has('[data-open-thread]')) await page.click('[data-open-thread]')
  await sleep(150)
  res[9] = await page.evaluate(() => document.body.innerText.includes('риштування на 40 квадратів'))
  // 10: з колонки «Чат з клієнтом» — AI-підказка, SMS зі статусом доставки.
  await open(v, 'sms-after-call', 'operator', { p: 'calls:all' })
  let ok10 = false
  if (await has('[data-chat-cell]')) {
    await page.click('[data-chat-cell]')
    await sleep(150)
    ok10 = (await has('[data-ai-draft]')) && (await has('[data-send]'))
    if (ok10) {
      await page.click('[data-send]')
      await sleep(150)
      ok10 = await has('[data-delivery]')
    }
  }
  res[10] = ok10
  // 11: порожній стан листування.
  await open(v, 'empty', 'operator', { p: 'cp:cp-empty' })
  await openComms()
  res[11] = await has('[data-empty-chat]')
  return res
}

async function layoutChecks(v) {
  const bad = []
  const replyHidden = []
  const comps = new Set()
  for (const s of [...SCENES, ...EDGES]) {
    await open(v, s)
    if (await hscroll()) bad.push(s)
    for (const c of await chatComponents()) comps.add(c)
    const g = await replyGeom()
    if (g && !g.visible) replyHidden.push(s)
    if (SHOTS) {
      mkdirSync('shots', { recursive: true })
      await page.screenshot({ path: `shots/${v}-${s}.png` })
    }
  }
  // Точки входу, де листування може жити поза сценою за замовчуванням.
  for (const extra of [{ p: 'calls:all' }, { p: 'calls:messengers' }, { p: 'calls:messengers', d: 'thread:th-koval' }, { p: 'mytasks' }, { p: 'cp:cp-koval' }]) {
    await open(v, 'mixed-day', 'operator', extra)
    if (extra.p.startsWith('cp:')) await openComms()
    for (const c of await chatComponents()) comps.add(c)
  }
  return { hscroll: bad, replyHidden, components: [...comps] }
}

const table = []
for (const v of VARIANTS) {
  console.log(`\n── варіант ${v}`)
  const s1 = await poolToReply(v, 'tg-new')
  const s5 = await poolToReply(v, 'no-reply')
  const k1 = await keyboard(v, 'tg-new')
  const k5 = await keyboard(v, 'no-reply')
  const m6 = await monthAnswer(v)
  const l7 = await lostList(v)
  const s3 = await mixedDayOrder(v)
  const checks = await sceneChecks(v)
  const lay = await layoutChecks(v)
  const shifts = [s1.shift, s5.shift].filter((x) => x != null)
  const row = {
    variant: v,
    poolToReply1: s1.ok ? s1.clicks : null,
    poolToReply5: s5.ok ? s5.clicks : null,
    keyboard1: k1,
    keyboard5: k5,
    cardToMonth6: m6,
    toLost7: l7,
    components: lay.components.length,
    replyShift: shifts.length ? Math.max(...shifts) : null,
    scenes: {
      1: s1.ok,
      2: checks[2],
      3: s3.all4 && s3.counter === '4',
      4: checks[4],
      5: s5.ok && checks[5],
      6: m6 != null,
      7: l7 != null,
      8: checks[8],
      9: checks[9],
      10: checks[10],
      11: checks[11],
    },
    detail: { s3, s1note: s1.note ?? null, hscroll: lay.hscroll, replyHidden: lay.replyHidden, componentNames: lay.components },
  }
  table.push(row)
  const f = (x) => (x == null ? '—' : String(x))
  console.log(`  кліки пул → відповідь, сц. 1 / 5: ${f(row.poolToReply1)} / ${f(row.poolToReply5)}${s1.note ? `  (${s1.note})` : ''}`)
  console.log(`  клавіатура, сц. 1 / 5:            ${f(k1)} / ${f(k5)}`)
  console.log(`  кліки картка → «місяць», сц. 6:   ${f(m6)}`)
  console.log(`  кліки до втрачених, сц. 7:        ${f(l7)}`)
  console.log(`  компонентів листування:           ${row.components}  ${lay.components.join(', ')}`)
  console.log(`  макс. зсув поля відповіді, px:    ${f(row.replyShift)}`)
  console.log(`  сцена 3: записів у порядку — ${s3.all4 ? 'так' : 'ні'} (${s3.from}), лічильник 15:34 — ${f(s3.counter)}`)
  console.log(`  сцени пройдено: ${Object.entries(row.scenes).filter(([, x]) => x).map(([k]) => k).join(', ') || 'жодної'}`)
  console.log(`  горизонтальний скрол 1280×720: ${lay.hscroll.length ? lay.hscroll.join(', ') : 'немає'}`)
  if (lay.replyHidden.length) console.log(`  поле відповіді за межами екрана: ${lay.replyHidden.join(', ')}`)
}

if (pageErrors.length) console.log(`\n[pageerror] ×${pageErrors.length}: ${[...new Set(pageErrors)].slice(0, 3).join(' | ')}`)
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(table, null, 2))
await browser.close()
