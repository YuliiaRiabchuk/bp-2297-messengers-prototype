import { useLayoutEffect } from 'react'
import {
  acquireScrollPin,
  findScrollParent,
  releaseScrollPin,
} from '@/lib/scroll-anchor'
import type { RefObject } from 'react'

/**
 * While `active`, pin `ref`'s element at its current vertical position inside
 * its scroll container: if content ABOVE it resizes (an async panel fills in, a
 * section expands), compensate the container's `scrollTop` so the element does
 * not move on screen.
 *
 * Use it for a trigger whose popover/dropdown must stay put while open — content
 * streaming in above (e.g. the call's AI analysis) would otherwise shove the
 * trigger, and the Radix popper dutifully follows it down (BP-466 follow-up).
 *
 * Detection is event-driven: a MutationObserver on the scroller's subtree (an
 * async panel arriving IS a DOM mutation) plus a ResizeObserver on the direct
 * content child. Deliberately NOT an rAF loop — rAF pauses in background tabs,
 * and NOT only a ResizeObserver on the wrapper — drawer wrappers are often
 * `h-full` (fixed box, grow via overflow), so their resize never fires. A user
 * scroll produces no mutations, so the pin never fights manual scrolling.
 *
 * Compensation is position-based (drive the element back to its frozen screen
 * position), so it self-corrects and never overshoots.
 *
 * While active it registers the scroll container as pinned so the coarser
 * {@link useScrollHeightCompensation} yields — one writer per resize, no
 * double-compensation.
 */
export function useAnchorScrollPin(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useLayoutEffect(() => {
    const el = ref.current
    if (!active || !el) return

    const scroller = findScrollParent(el)
    if (!scroller) return

    // Freeze the element's screen position at open time.
    let targetTop = el.getBoundingClientRect().top
    let lastScrollTop = scroller.scrollTop

    const reAnchor = () => {
      lastScrollTop = scroller.scrollTop
      targetTop = el.getBoundingClientRect().top
    }

    const compensate = () => {
      // scrollTop moved since we last looked and it wasn't us — a manual
      // scroll. That's an intentional move: re-anchor instead of yanking the
      // container back. Checked here (not only via the `scroll` listener)
      // because scroll events dispatch on frame boundaries — a mutation can
      // sneak in before the event and see a stale anchor.
      if (scroller.scrollTop !== lastScrollTop) {
        reAnchor()
        return
      }
      const delta = el.getBoundingClientRect().top - targetTop
      if (delta === 0) return
      scroller.scrollTop += delta
      // Track our own write; if the scroller couldn't absorb the whole delta
      // (hit its range), re-anchor to wherever the element actually ended up.
      reAnchor()
    }

    // A manual scroll moves the element on purpose — accept the new position
    // as the anchor. Our own `scrollTop` writes also land here, but they're
    // re-anchored already, so re-reading is a no-op for them.
    scroller.addEventListener('scroll', reAnchor, { passive: true })

    const mutations = new MutationObserver(compensate)
    mutations.observe(scroller, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    })

    const resizes =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(compensate) : null
    const content = scroller.firstElementChild
    if (resizes && content) resizes.observe(content)

    acquireScrollPin(scroller)
    return () => {
      scroller.removeEventListener('scroll', reAnchor)
      mutations.disconnect()
      resizes?.disconnect()
      releaseScrollPin(scroller)
    }
  }, [active, ref])
}
