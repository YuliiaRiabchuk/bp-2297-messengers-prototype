import { useEffect, useState } from 'react'

/**
 * Медіа-запит як стан.
 *
 * Потрібен там, де від розміру залежить не CSS, а РІШЕННЯ компонента —
 * наприклад, чи розкривати картку за замовчуванням. Класами це не робиться:
 * `defaultOpen` читається один раз при монтуванні, і жоден `lg:` до нього не
 * дотягнеться.
 *
 * Початкове значення читається синхронно, ще до першого малювання: інакше
 * картка встигає розкритись і згорнутись, і на короткому екрані це видно як
 * смикання.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
