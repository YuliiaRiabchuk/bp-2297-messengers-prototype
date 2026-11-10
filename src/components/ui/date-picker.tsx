/**
 * Порт `DatePicker` з CRM (`apps/crm/src/components/ui/date-picker.tsx`):
 * lingui-рядки замінено українськими, зона проєкту — зоною браузера.
 */
import * as React from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format, isValid, parse } from 'date-fns'
import { uk as DATE_FNS_LOCALE } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover'

/**
 * DatePicker — single-date field with two synced input modes: type the date
 * by keyboard (auto-masked `dd.mm.yyyy`) OR pick it in the calendar popover.
 * Both drive the same `value`, so they stay in sync. Built on the shadcn
 * `Calendar` (react-day-picker). Design-system primitive; reuse instead of a
 * bare `<Input>` for any date entry.
 *
 * Controlled by `Date | undefined`. Display/parse format `dd.MM.yyyy`, RU
 * locale calendar chrome. Follows fe-design: semantic tokens, single Lucide
 * icon family, label lives above the field at the callsite (F5).
 */
export interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  onBlur?: () => void
  placeholder?: string
  id?: string
  disabled?: boolean
  /** Constrain calendar-selectable days (keyboard entry stays unrestricted). */
  fromDate?: Date
  className?: string
  'aria-invalid'?: boolean
  'data-testid'?: string
}

const DATE_FORMAT = 'dd.MM.yyyy'

/** Полночь дня `d` в настенной зоне ПРОЕКТА (`APP_TZ`) — нижняя граница
 *  календаря живёт в тех же сутках, что дни сетки (BP-477). */
function appMidnight(d: Date): Date {
  // Прототип живе в одній зоні з браузером: настінний час = локальний.
  const wall = new Date(d)
  wall.setHours(0, 0, 0, 0)
  return wall
}

/** Свободный текст → Date (или null). Берём 8 цифр (ддммгггг) независимо от
 *  точек. Нормализация только на blur — курсор не прыгает при правке одной
 *  цифры в середине. */
function normalizeDate(text: string): Date | null {
  const d = text.replace(/\D/g, '').slice(0, 8)
  if (d.length !== 8) return null
  const parsed = parse(
    `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4, 8)}`,
    DATE_FORMAT,
    new Date(),
  )
  return isValid(parsed) ? parsed : null
}

export function DatePicker({
  value,
  onChange,
  onBlur,
  placeholder = 'дд.мм.рррр',
  id,
  disabled,
  fromDate,
  className,
  'aria-invalid': ariaInvalid,
  'data-testid': testId,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  // Обёртка поля (input + иконка) — служит Radix-анкором попап и якорем для
  // guard'а dismiss'а: фокус/клик внутри неё не должен закрывать календарь.
  const fieldRef = React.useRef<HTMLDivElement>(null)
  const formatted = value ? format(value, DATE_FORMAT) : ''
  const [text, setText] = React.useState(formatted)
  // Отображаемый месяц календаря — контролируем, чтобы при ручном вводе даты
  // календарь сам перелистывался на неё; ручную навигацию сохраняем через
  // `onMonthChange`. Без значения открываемся на первом ДОСТУПНОМ месяце
  // (`fromDate`), а не на сегодняшнем — иначе пикер с нижней границей в
  // будущем встречает пользователя месяцем сплошь из disabled-дней.
  const [month, setMonth] = React.useState<Date | undefined>(
    value ?? fromDate,
  )
  // Живая валидация ручного ввода: полный (8 цифр), но непарсибельный —
  // краснеем сразу. Валидная дата (в т.ч. прошлая) КОММИТИТСЯ (юзер 13.07:
  // «позволяй писать любую дату») — «в прошлом» решает владелец
  // (aria-invalid проп + своя подпись/гейт сабмита).
  const [parseError, setParseError] = React.useState(false)

  // Sync local text whenever the controlled value changes (calendar pick,
  // form reset, external update). `formatted` is a primitive — стабильно
  // между рендерами при той же дате, поэтому частичный ручной ввод (когда
  // onChange ещё не вызван) не сбрасывается.
  React.useEffect(() => {
    setText(formatted)
    if (value) setMonth(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatted])

  // Свободный ввод: чистим только мусор (цифры + точки), НЕ переформатируем —
  // курсор не прыгает при правке одной цифры в середине (как в TimeField).
  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value.replace(/[^\d.]/g, '').slice(0, 10)
    setText(next)
    const digits = next.replace(/\D/g, '')
    if (digits.length < 8) {
      setParseError(false)
      return
    }
    const norm = normalizeDate(next)
    setParseError(norm == null)
  }

  // Нормализация и коммит — на blur/Enter. Пусто → очистка; валидная дата
  // (включая прошлую) → коммит. Непарсибельный ввод держится красным,
  // значение не меняется.
  function commitText() {
    // Текст не менялся → no-op: blur-коммит дёргал бы state (новый Date на
    // полуночи) в момент mousedown по дню календаря — ре-рендер подменял DOM
    // под курсором, click не долетал, дату приходилось кликать дважды (юзер
    // 10.07).
    if (text === formatted) return
    if (text === '') {
      setParseError(false)
      onChange?.(undefined)
      return
    }
    const norm = normalizeDate(text)
    if (norm) {
      setParseError(false)
      setText(format(norm, DATE_FORMAT))
      onChange?.(norm)
    } else {
      setParseError(true)
    }
  }

  function handleBlur() {
    onBlur?.()
    commitText()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    // Enter = ввод даты (юзер 13.07): коммит + закрыть календарь, форму не
    // сабмитим.
    e.preventDefault()
    commitText()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative" ref={fieldRef}>
          <button
            type="button"
            aria-label="Відкрити календар"
            disabled={disabled}
            onClick={() => setOpen((o) => !o)}
            className="absolute left-0 top-0 flex h-full w-8 items-center justify-center text-subtle transition-colors hover:text-fg-2 disabled:pointer-events-none"
          >
            <CalendarIcon className="size-3.5" aria-hidden="true" />
          </button>
          <Input
            id={id}
            value={text}
            onChange={handleInput}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            inputMode="numeric"
            autoComplete="off"
            data-testid={testId}
            aria-invalid={ariaInvalid || parseError || undefined}
            className={cn('pl-8 pr-8 tabular-nums', className)}
          />
          {value && (
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-label lowercase text-subtle">
              {format(value, 'EEEEEE', { locale: DATE_FNS_LOCALE })}
            </span>
          )}
        </div>
      </PopoverAnchor>
      {/* `onOpenAutoFocus` гасим — фокус остаётся в input, чтобы можно было
          одновременно печатать дату вручную и видеть/кликать календарь. */}
      <PopoverContent
        className="w-auto p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Не отдаём фокус календарю на mousedown: input не блюрится во время
        // клика по дню → нет blur-коммита/ре-рендера между mousedown и click —
        // выбор срабатывает с ПЕРВОГО клика (юзер 10.07). Кликам react-day-
        // picker фокус не нужен.
        onMouseDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Поле само открывает календарь по фокусу — поэтому открывающий
          // фокус/клик, который приходится НА input (формально «вне» контента
          // попапа), не должен считаться dismiss'ом. Без этого guard'а Radix
          // закрывает календарь в том же тике, в котором открыл (мигание).
          const target = e.detail.originalEvent.target as Node | null
          if (target && fieldRef.current?.contains(target)) e.preventDefault()
        }}
      >
        <Calendar
          mode="single"
          locale={DATE_FNS_LOCALE}
          selected={value}
          month={month}
          onMonthChange={setMonth}
          // Полночь ЗОНЫ ПРОЕКТА, не машины: `fromDate` приходит с временем
          // (new Date() «сейчас»), а дни сетки — TZDate APP_TZ (от
          // month/selected из `inAppTz`). Машинная полночь на западе от
          // Киева «позже» киевской, differenceInCalendarDays давал 1 — и
          // {before} гасил САМ сегодняшний день (юзер 13.07: «сегодня
          // должно быть всегда доступно»). Киевская полночь корректна и
          // против plain-Date сетки (wall-clock нормализация).
          disabled={fromDate ? { before: appMidnight(fromDate) } : undefined}
          onSelect={(date) => {
            // Клик по УЖЕ выбранному дню react-day-picker шлёт как deselect
            // (undefined) — это НЕ «очистить срок» (юзер 13.07: клик
            // «сегодня» обнулял всё поле). Повторный выбор = no-op.
            if (!date) {
              setOpen(false)
              return
            }
            // Текст — сразу же: закрытие попапа возвращает фокус и БЛЮРИТ
            // input, blur-коммит со stale-текстом перезатирал только что
            // выбранную дату (первый клик «не срабатывал», юзер 10.07). Со
            // свежим текстом blur попадает в no-op guard `text === formatted`.
            setText(format(date, DATE_FORMAT))
            setParseError(false)
            onChange?.(date)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
