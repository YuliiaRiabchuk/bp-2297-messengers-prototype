import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { SCENES, SCENE_BY_ID } from './scenes'
import { ROLES, VARIANTS, type Role } from './variants'

/**
 * Стан перегляду: варіант, сцена, роль.
 *
 * Живе НАД компоновкою. Дзеркалиться в URL і localStorage; URL важливіший,
 * бо посилання, кинуте в чат, має відкрити рівно той кадр, який бачив
 * відправник.
 */
/** Q3: де в картці контрагента живе листування (для А, Б, В). */
export type CardLayout = 'widget' | 'history' | 'tabs'
export const CARD_LAYOUTS: { key: CardLayout; label: string; note: string }[] = [
  { key: 'widget', label: 'Віджет', note: '«Комунікації» на всю ширину одразу під «Орендами та резервами»' },
  { key: 'history', label: 'В «Історії»', note: 'листування на місці «Історії» в лівій колонці спліта' },
  { key: 'tabs', label: 'Вкладки', note: 'у картці зʼявляються вкладки, «Комунікації» — окрема' },
]
const isLayout = (v: string | null | undefined): v is CardLayout => v === 'widget' || v === 'history' || v === 'tabs'

/**
 * Режим показу клієнту (`?demo=1`): тільки варіант Д і три сцени простою
 * мовою. Повний режим з усіма варіантами — за звичайним посиланням.
 */
export const DEMO_VARIANT = 'Д'
export const DEMO_SCENES: { id: string; title: string; hint: string; role: Role }[] = [
  {
    id: 'no-reply',
    title: 'Клієнт пише в Telegram',
    hint: 'Нове повідомлення спливає праворуч угорі в усіх менеджерів. «Взяти діалог» — і він ваш. Відповідайте; перейдіть у «Каталог» — чат лишиться відкритим у куті. Наприкінці — «Завершити діалог».',
    role: 'operator',
  },
  {
    id: 'mixed-day',
    title: 'Дзвінки й переписка разом',
    hint: 'Клієнт дзвонив і писав — усе в одній стрічці по днях. Біля кожного повідомлення видно канал і хто відповідав.',
    role: 'operator',
  },
  {
    id: 'regular-ul',
    title: 'Картка постійного клієнта',
    hint: 'Вкладка «Комунікації»: угорі — скільки оренд і повідомлень, праворуч — досьє, у центрі — уся переписка. «Підсумок» — коротко про останню розмову.',
    role: 'head',
  },
]
export const isDemo = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('demo') === '1'

interface ViewState {
  sceneId: string
  variant: string
  role: Role
  card: CardLayout
}

interface LabState extends ViewState {
  /** Ключ стану даних: сцена і варіант перезбирають дані з нуля. */
  resetKey: string
  resetScene: () => void
  setScene: (sceneId: string) => void
  setVariant: (code: string) => void
  setRole: (role: Role) => void
  setCard: (card: CardLayout) => void
  hidden: boolean
  setHidden: (v: boolean) => void
  /** Режим показу клієнту. */
  demo: boolean
}

const LabContext = createContext<LabState | null>(null)

const STORAGE_KEY = 'bp-messengers.lab'

const isVariant = (v: string | null | undefined): v is string => !!v && VARIANTS.some((x) => x.code === v)
const isRole = (v: string | null | undefined): v is Role => !!v && (ROLES as string[]).includes(v)

/** URL — чужий ввід: невідомі значення мовчки відкидаються, а не ламають кадр. */
function readUrl(): Partial<ViewState> & { hidden?: boolean } {
  if (typeof window === 'undefined') return {}
  const q = new URLSearchParams(window.location.search)
  const out: Partial<ViewState> & { hidden?: boolean } = {}
  const scene = q.get('scene')
  if (scene && SCENE_BY_ID.has(scene)) out.sceneId = scene
  const v = q.get('v')
  if (isVariant(v)) out.variant = v
  const role = q.get('role')
  if (isRole(role)) out.role = role
  const card = q.get('card')
  if (isLayout(card)) out.card = card
  if (q.get('lab') === 'off') out.hidden = true
  return out
}

function readStorage(): Partial<ViewState> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function LabProvider({ children }: { children: ReactNode }) {
  const url = readUrl()
  const stored = readStorage()
  const [demo] = useState(isDemo)
  const demoScene = DEMO_SCENES.find((s) => s.id === url.sceneId) ?? DEMO_SCENES[0]
  const [view, setView] = useState<ViewState>(() =>
    demo
      ? { sceneId: demoScene.id, variant: DEMO_VARIANT, role: demoScene.role, card: 'tabs' }
      : {
          sceneId: (SCENE_BY_ID.get(url.sceneId ?? stored.sceneId ?? '') ?? SCENES[0]).id,
          variant: url.variant ?? (isVariant(stored.variant) ? stored.variant : VARIANTS[0].code),
          role: url.role ?? (isRole(stored.role) ? stored.role : 'operator'),
          card: url.card ?? (isLayout(stored.card) ? stored.card : 'widget'),
        },
  )
  const [hidden, setHidden] = useState(Boolean(url.hidden))
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URLSearchParams(window.location.search)
    q.set('v', view.variant)
    q.set('scene', view.sceneId)
    q.set('role', view.role)
    q.set('card', view.card)
    if (hidden) q.set('lab', 'off')
    else q.delete('lab')
    window.history.replaceState(null, '', `${window.location.pathname}?${q}`)
    if (demo) return // показ клієнту не перезаписує збережений повний режим
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(view))
    } catch {
      /* сховище недоступне — посилання все одно працює */
    }
  }, [view, hidden, demo])

  // Ctrl+. ховає віджет цілком: у кадри для бізнесу він не потрапляє.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '.') {
        e.preventDefault()
        setHidden((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo<LabState>(
    () => ({
      ...view,
      resetKey: `${view.sceneId}|${view.variant}|${nonce}`,
      resetScene: () => setNonce((n) => n + 1),
      setScene: (sceneId) => {
        if (!SCENE_BY_ID.has(sceneId)) return
        const d = demo ? DEMO_SCENES.find((s) => s.id === sceneId) : undefined
        if (demo && !d) return
        setView((v) => ({ ...v, sceneId, ...(d ? { role: d.role } : {}) }))
      },
      setVariant: (variant) => setView((v) => ({ ...v, variant })),
      setRole: (role) => setView((v) => ({ ...v, role })),
      setCard: (card) => setView((v) => ({ ...v, card })),
      hidden,
      setHidden,
      demo,
    }),
    [view, nonce, hidden, demo],
  )

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>
}

export function useLab(): LabState {
  const ctx = useContext(LabContext)
  if (!ctx) throw new Error('useLab must be used inside LabProvider')
  return ctx
}
