# Product

## Register

product

## Users

Internal staff of a building-equipment rental business on the Ukrainian market: rental managers, warehouse operators, and call-center agents. They work at a desk through long shifts, often with the screen open all day, juggling many records at once (rentals, reserves, the equipment catalog, counterparties, calls). Context is high-volume and time-pressured: a customer is on the phone or at the counter while the operator searches stock, builds a booking, and checks availability across warehouses. The job to be done is to find equipment, see real availability per warehouse, assemble a rent/reserve fast, and not lose track of state.

This is a rewrite/consolidation of an existing production Django CRM (`repos/bud-prokat`) with 1C integrations; the audience already knows the domain and expects the new tool to be faster, not prettier-at-the-cost-of-speed.

## Product Purpose

A CRM that runs the rental operation end to end: warehouse catalog with per-warehouse, reserve-aware availability; rent and reserve creation; counterparties; call-center module; documents and FOP/contract handling. It exists to replace fragmented legacy tooling (old CRM + spreadsheets + 1C) with one fast, accurate workspace. Success = an operator completes a booking in fewer steps with correct availability, and trusts the numbers on screen.

## Brand Personality

Fast, dense, precise. Voice is plain and operational, not marketing. Russian/Ukrainian domain language, exact terms (наличие / резерв / аренда / ремонт), no buzzwords. The interface should feel like a professional instrument: Linear/Notion-level precision and restraint, information-rich but never noisy. Emotional goal: operator confidence and speed, never decoration for its own sake.

## Anti-references

- **Old 1C / accounting CRM**: gray 2010-era dense grids, system fonts, visual noise, everything-bordered tables.
- **Loud SaaS landing**: gradients, oversized heroes, marketing cards or empty hero cards inside the working UI.
- **Toy / bright**: heavy color, big radii, emoji in chrome, illustrations.
- **Generic Material / Bootstrap**: default framework look with no identity.

## Design Principles

- **Density without noise.** Maximize records per screen, minimize chrome. Use grouping (sticky headers), inline meta, and availability chips instead of cards-everywhere. Cards are the lazy answer; reach for them only when they're the right affordance.
- **Speed is a feature.** No per-keystroke round-trips, no synchronous route re-renders on frequent UI toggles, virtualize long/duplicating lists, memoize looped rows with stable props. A measured lag is a bug. (See `.claude/rules/performance.md`.)
- **Honest state.** Numbers and availability carry the weight: show наличие/резерв/аренда/ремонт truthfully, surface "нет в наличии" and empty/error states plainly rather than hiding gaps.
- **One visual system.** Color from semantic tokens (`bg-danger`, never `bg-red-500`), one neutral family, one Lucide icon family, chrome chroma low (≤0.03); saturated hue lives only in CTAs, semantic states, and status chips. (See `.claude/rules/fe-design.md`.)
- **Domain language is the UI.** Use the operator's exact vocabulary; the layout serves the workflow on each screen, not a generic template.

## Accessibility & Inclusion

WCAG AA, pragmatic. Body contrast ≥4.5:1 (no light-gray-on-tint), full keyboard operability and visible focus on the dense interactive surfaces (tables, pickers, drag handles, popovers), and a `prefers-reduced-motion` alternative for every animation. No formal audit/screen-reader certification required, but ARIA labels on icon-only controls and correct roles on custom widgets are expected.
