import { useEffect, useState } from 'react'

/**
 * Мінімальні тости для порту проду (у CRM — sonner). Подія на `window`, тож
 * викликати можна з будь-якого місця без провайдера.
 */
interface ToastItem {
  id: number
  title: string
  description?: string
}

let next = 1

export function toast(title: string, description?: string) {
  window.dispatchEvent(new CustomEvent<ToastItem>('bp-toast', { detail: { id: next++, title, description } }))
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<ToastItem>).detail
      setItems((xs) => [...xs, t])
      window.setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 5000)
    }
    window.addEventListener('bp-toast', on)
    return () => window.removeEventListener('bp-toast', on)
  }, [])
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-tooltip flex w-[22rem] flex-col gap-2" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="pointer-events-auto rounded-lg border border-border bg-card px-4 py-3 shadow-dialog" data-testid="toast">
          <p className="text-body font-medium text-fg">{t.title}</p>
          {t.description && <p className="mt-0.5 text-label text-muted-fg">{t.description}</p>}
        </div>
      ))}
    </div>
  )
}
