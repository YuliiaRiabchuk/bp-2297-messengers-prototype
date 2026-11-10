import { cn } from '@/lib/utils'

/**
 * Мітка «пропозиція»: усе нове відносно проду підписане (§6 брифу). Тиха,
 * щоб не сперечатися з інтерфейсом, але читається з першого погляду.
 */
export function Proposal({ className, title }: { className?: string; title?: string }) {
  return (
    <span
      title={title ?? 'Нове відносно проду — пропозиція'}
      data-proposal=""
      className={cn(
        'inline-flex shrink-0 items-center rounded-sm border border-dashed border-violet/50 px-1 text-mono font-medium lowercase leading-[15px] text-violet-fg',
        className,
      )}
    >
      пропозиція
    </span>
  )
}
