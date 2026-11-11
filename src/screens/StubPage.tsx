import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { CELL, FULL_BLEED, HEAD_CELL, PageTab, PageTabStrip } from '@/components/crm'
import { Toolbar } from '@/screens/calls/CallsPage'

/**
 * Розділи CRM, куди оператор іде посеред переписки (коментар Уракова 2):
 * каталог, оренди, резерви. Заглушки — мета показати, що чат лишається
 * відкритим, а не відтворити розділи.
 */
const DATA = {
  catalog: {
    title: 'Каталог',
    cols: ['Модель', 'Категорія', 'Куренівка', 'Позняки', 'Оболонь', 'Ціна / доба'],
    rows: [
      ['Генератор Honda EU22i', 'Генератори', '2', '0', '1', '650 грн'],
      ['Генератор 5 кВт', 'Генератори', '1', '1', '0', '900 грн'],
      ['Відбійний молоток Makita HM1203C', 'Електроінструмент', '3', '1', '2', '420 грн'],
      ['Віброплита 90 кг', 'Ущільнення', '1', '0', '1', '650 грн'],
      ['Риштування рамні, секція 2×1 м', 'Риштування', '120', '60', '200', '25 грн'],
      ['Плиткоріз Sigma 3B4', 'Плитка', '0', '2', '1', '300 грн'],
    ],
  },
  rents: {
    title: 'Оренди',
    cols: ['Код', 'Контрагент', 'Обладнання', 'Відділення', 'До', 'Статус'],
    rows: [
      ['А-9PL3D', 'ТОВ «Міськбуд-Сервіс»', 'Риштування рамні 120 м²', 'Оболонь', '17.11', 'Активна'],
      ['А-7R2MC', 'ФОП Савчук Р. М.', 'Бетонозмішувач 160 л', 'Куренівка', '16.11', 'Активна'],
      ['А-6BG2K', 'Павленко Дмитро', 'Болгарка Makita GA9020', 'Куренівка', '23.10', 'Закрита'],
    ],
  },
  reserves: {
    title: 'Резерви',
    cols: ['Код', 'Контрагент', 'Обладнання', 'Відділення', 'На коли', 'Статус'],
    rows: [
      ['Р-8M2DX', 'Коваль Сергій Петрович', 'Генератор Honda EU22i', 'Куренівка', '10.11 9:00', 'Активен'],
      ['Р-5W1PK', 'Литвин Оксана Василівна', 'Плиткоріз Sigma 3B4', 'Позняки', '11.11 9:00', 'Активен'],
      ['Р-3K9TA', 'Лисенко Андрій Іванович', 'Перфоратор Bosch GBH 2-26', 'Куренівка', '09.11', 'Активен'],
    ],
  },
} as const

export function StubPage({ name }: { name: keyof typeof DATA }) {
  const d = DATA[name]
  return (
    <div className="flex h-full min-w-0 flex-col" data-testid={`stub-${name}`}>
      <PageTabStrip>
        <PageTab active onClick={() => {}}>
          {d.title}
        </PageTab>
      </PageTabStrip>
      <Toolbar placeholder="Пошук" />
      <div className="min-h-0 flex-1 overflow-auto">
        <table className={cn('w-full table-fixed border-separate border-spacing-0', FULL_BLEED)}>
          <thead>
            <tr>
              {d.cols.map((c) => (
                <th key={c} className={HEAD_CELL}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r) => (
              <tr key={r[0]} className="hover:bg-muted/50">
                {r.map((v, i) => (
                  <td key={i} className={cn(CELL, i === 0 && 'font-medium text-fg')}>
                    {i === r.length - 1 && name !== 'catalog' ? <Badge variant={v === 'Закрита' ? 'default' : 'success'}>{v}</Badge> : v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
