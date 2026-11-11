import { Bookmark, FileText, Phone, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { CounterpartyAvatar } from '@/components/crm'
import { staffById } from '@/mock/select'
import { minutesBetween, shortDate } from '@/lib/time'
import { useStore } from '@/state/store'
import type { Counterparty, Occasion, Thread } from '@/mock/types'
import { CHANNEL_META } from '../chat/Thread'
import { ownerFor, SimpleChat, type Flavor } from './SimpleChat'

/**
 * Вкладка «Комунікації» (коментар Уракова 3): у центрі месенджер із блоками
 * інформації, праворуч — постійне досьє контрагента, як на сторінці
 * контрагента зараз. Історія операцій сюди не потрапляє — вона на «Картці».
 */
function occasions(t: Thread | null): (Occasion & { at: string })[] {
  if (!t) return []
  const out: (Occasion & { at: string })[] = []
  for (const e of t.events) {
    const o = e.kind === 'call' ? e.created : e.kind === 'system' ? e.occasion : undefined
    if (o && !out.some((x) => x.code === o.code)) out.push({ ...o, at: e.at })
  }
  return out.reverse()
}

export function CommsPage({ cp, thread, flavor }: { cp: Counterparty; thread: Thread | null; flavor: Flavor }) {
  const { world } = useStore()
  const occ = occasions(thread)
  const rents = occ.filter((o) => o.kind === 'rent')
  const activeRents = rents.filter((o) => !o.until || o.until > world.now)
  const reserves = occ.filter((o) => o.kind === 'reserve')
  const msgs = thread?.events.filter((e) => e.kind === 'msg') ?? []
  const msgs30 = msgs.filter((e) => minutesBetween(e.at, world.now) <= 30 * 24 * 60).length
  const calls = thread?.events.filter((e) => e.kind === 'call') ?? []
  const missed = calls.filter((e) => e.kind === 'call' && e.dir === 'missed').length
  const owner = thread ? ownerFor(flavor)(world, thread) : null
  const lead = staffById(world, owner?.staffId)

  const blocks: { label: string; value: string; sub?: string }[] = [
    { label: 'Оренди', value: String(rents.length), sub: activeRents.length ? `${activeRents.length} активна` : 'активних немає' },
    { label: 'Резерви', value: String(reserves.length) },
    { label: 'Повідомлення', value: String(msgs.length), sub: `${msgs30} за 30 днів` },
    { label: 'Дзвінки', value: String(calls.length), sub: missed ? `${missed} пропущених` : undefined },
    { label: 'Веде', value: lead ? lead.name.split(' ')[0] : '—', sub: owner?.responsible ? 'відповідальний' : owner?.lastContact ? 'останній контакт' : lead ? 'взяв розмову' : undefined },
  ]

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_300px] gap-3.5">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card" data-testid="card-comms">
        <dl className="grid shrink-0 grid-cols-5 divide-x divide-border border-b border-border" data-info-blocks="">
          {blocks.map((b) => (
            <div key={b.label} className="min-w-0 px-3 py-2">
              <dt className="text-mono font-semibold uppercase tracking-wider text-muted-fg">{b.label}</dt>
              <dd className="truncate text-title font-semibold tabular-nums text-fg">{b.value}</dd>
              {b.sub && <dd className="truncate text-label text-muted-fg">{b.sub}</dd>}
            </div>
          ))}
        </dl>
        <div className="min-h-0 flex-1">
          {thread ? (
            <SimpleChat threadId={thread.id} host="card" flavor={flavor} />
          ) : (
            <p className="py-10 text-center text-body text-muted-fg" data-empty-chat="">
              З клієнтом ще не було ні дзвінків, ні листування.
            </p>
          )}
        </div>
      </section>
      <Dossier cp={cp} thread={thread} occ={occ} />
    </div>
  )
}

/** Досьє контрагента праворуч — коротко, як на прод-картці (`DossierPanel`). */
function Dossier({ cp, thread, occ }: { cp: Counterparty; thread: Thread | null; occ: (Occasion & { at: string })[] }) {
  const { world } = useStore()
  const manager = staffById(world, cp.managerId)
  const handles = [
    cp.telegram && { ch: 'telegram' as const, v: cp.telegram },
    cp.viber && { ch: 'viber' as const, v: cp.viber },
  ].filter(Boolean) as { ch: 'telegram' | 'viber'; v: string }[]
  const tgFromThread = !cp.telegram && thread?.events.some((e) => e.kind === 'msg' && e.channel === 'telegram')
  return (
    <aside className="flex min-h-0 flex-col overflow-y-auto rounded-xl border border-border bg-card" aria-label="Досьє контрагента" data-dossier="">
      <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
        <CounterpartyAvatar cp={cp} size={8} />
        <div className="min-w-0">
          <div className="truncate text-body font-semibold text-fg">{cp.name}</div>
          <div className="flex items-center gap-1.5 text-label text-muted-fg">
            {cp.kind === 'UL' ? 'Юрособа' : cp.kind === 'TEMP' ? 'Тимчасовий' : 'Фізособа'}
            {cp.trust === 'reliable' && <Badge variant="success">Благонадійний</Badge>}
          </div>
        </div>
      </div>
      <Section title="Контакти">
        <Row icon={<Phone className="size-3.5" />} text={cp.phone ?? '—'} />
        {handles.map((h) => {
          const Icon = CHANNEL_META[h.ch].icon
          return <Row key={h.ch} icon={<Icon className="size-3.5" />} text={`${CHANNEL_META[h.ch].label} · ${h.v}`} />
        })}
        {tgFromThread && <Row icon={<TgIcon className="size-3.5" />} text="Telegram · пише в бот" />}
        {manager && <Row text={`Відповідальний: ${manager.name}`} />}
      </Section>
      {cp.kind === 'UL' && (
        <Section title="Рахунок клієнта">
          <Row icon={<Wallet className="size-3.5" />} text="До сплати: 41 720 грн · рахунок № 1186" />
        </Section>
      )}
      <Section title="Оренди та резерви">
        {occ.length ? (
          occ.map((o) => (
            <div key={o.code} className="flex items-center gap-2 py-1 text-label">
              {o.kind === 'rent' ? <FileText className="size-3.5 text-muted-fg" aria-hidden /> : <Bookmark className="size-3.5 text-muted-fg" aria-hidden />}
              <span className="font-medium tabular-nums text-fg">{o.code}</span>
              <span className="min-w-0 flex-1 truncate text-fg-2">{o.label}</span>
              <span className={cn('shrink-0 tabular-nums text-muted-fg', o.until && o.until > world.now && 'text-success-fg')}>
                {o.until ? `до ${shortDate(o.until)}` : shortDate(o.at)}
              </span>
            </div>
          ))
        ) : (
          <p className="text-label text-muted-fg">Немає</p>
        )}
      </Section>
    </aside>
  )
}

const TgIcon = CHANNEL_META.telegram.icon

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-3.5 py-2.5 last:border-0">
      <h3 className="mb-1 text-mono font-semibold uppercase tracking-wider text-muted-fg">{title}</h3>
      {children}
    </section>
  )
}

function Row({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-label text-fg-2">
      {icon && <span className="text-muted-fg">{icon}</span>}
      <span className="min-w-0 truncate">{text}</span>
    </div>
  )
}
