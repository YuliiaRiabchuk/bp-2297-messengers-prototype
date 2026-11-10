import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// The DESIGN.md type scale lives in @theme as custom `--text-*` tokens
// (text-headline/title/body/label/mono — see globals.css, BP-372). Plain
// tailwind-merge doesn't know these are font-SIZES, so it groups them with
// `text-{color}` and drops the size when both land in one `cn(...)` — e.g.
// `cn('text-mono', 'text-subtle')` silently lost the size. Registering them
// in the font-size group lets a size and a color coexist.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['headline', 'title', 'body', 'label', 'mono'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
