/**
 * Shared helpers for manual scroll-anchoring — keeping on-screen content still
 * while blocks above it resize. Used by {@link useScrollHeightCompensation}
 * (BP-466, keeps content below a growing AI panel put) and
 * {@link useAnchorScrollPin} (keeps an open picker's trigger put).
 *
 * CSS `overflow-anchor` should do this, but is unreliable inside the flex
 * `overflow: auto` drawer containers, hence the JS observers.
 */

/** Nearest scrollable (`overflow-y: auto | scroll`) ancestor, or null. */
export function findScrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = window.getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
  }
  return null
}

// Which scroll containers currently have an active pin (an open picker holding
// its trigger fixed). While a container is pinned, the coarser height-delta
// compensation yields to the pin so the two never both adjust scrollTop for the
// same resize (double-compensation / overshoot). Ref-counted — a container may
// host more than one pin at a time.
const pinnedScrollers = new Map<Element, number>()

export function acquireScrollPin(scroller: Element): void {
  pinnedScrollers.set(scroller, (pinnedScrollers.get(scroller) ?? 0) + 1)
}

export function releaseScrollPin(scroller: Element): void {
  const next = (pinnedScrollers.get(scroller) ?? 0) - 1
  if (next <= 0) pinnedScrollers.delete(scroller)
  else pinnedScrollers.set(scroller, next)
}

export function isScrollPinned(scroller: Element): boolean {
  return (pinnedScrollers.get(scroller) ?? 0) > 0
}
