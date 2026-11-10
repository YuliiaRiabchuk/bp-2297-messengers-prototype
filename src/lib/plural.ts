/**
 * Українська форма множини: 1 доба, 2 доби, 5 діб.
 *
 * Жорстко зашита одна форма ламається на першому ж іншому числі, і ламається
 * тихо: «Оренда обладнання — 2 діб» їхало в друковану виписку клієнту.
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(n) % 100
  if (mod100 >= 11 && mod100 <= 14) return many
  const mod10 = Math.abs(n) % 10
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

/** «2 доби», «5 діб» — з числом. */
export function days(n: number): string {
  return `${n} ${plural(n, 'доба', 'доби', 'діб')}`
}

/** «на 1 добу, на 2 доби, на 18 діб» — знахідний відмінок, з числом. */
export function forDays(n: number): string {
  return `${n} ${plural(n, 'добу', 'доби', 'діб')}`
}
