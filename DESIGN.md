---
name: Будпрокат CRM
description: Fast, dense, precise CRM for building-equipment rental operators.
colors:
  ink: "#0c0a09"
  ink-2: "#292524"
  muted-fg: "#78716c"
  subtle: "#a8a29e"
  bg: "#fafafa"
  canvas: "#f5f5f4"
  card: "#ffffff"
  shell: "oklch(0.94 0 0)"
  muted: "#f5f5f4"
  border: "#e1ddd9"
  border-strong: "#cfcbc6"
  primary: "#0c0a09"
  primary-fg: "#fafaf9"
  accent: "oklch(0.55 0.13 250)"
  accent-soft: "oklch(0.96 0.02 250)"
  accent-fg: "oklch(0.32 0.13 250)"
  success: "oklch(0.55 0.13 150)"
  warning: "oklch(0.65 0.14 70)"
  danger: "oklch(0.58 0.20 28)"
  info: "oklch(0.82 0.16 95)"
  violet: "oklch(0.55 0.18 295)"
  brand-navy: "#1a1f3a"
  brand-red: "#e63946"
  kind-component: "oklch(0.93 0.03 75)"
  kind-element: "oklch(0.93 0.05 290)"
  kind-consumable: "oklch(0.93 0.05 230)"
typography:
  headline:
    fontFamily: "Inter, Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Inter, Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "-0.005em"
  label:
    fontFamily: "Inter, Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.02em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "16px"
components:
  button-default:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.primary-fg}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-default-hover:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.primary-fg}"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-ghost:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "32px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  badge:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "1px 8px"
  group-header:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.ink}"
    rounded: "0px"
    padding: "6px 12px"
---

# Design System: Будпрокат CRM

## 1. Overview

**Creative North Star: "The Operator's Console"**

This is an instrument, not a website. A rental operator keeps it open all shift, searching stock while a customer waits, assembling a booking, reading availability across warehouses at a glance. Every pixel of chrome it spends is a pixel of data it didn't show. The visual language is therefore quiet and dense: a near-white workspace card floating on a slightly darker shell, hairline borders instead of boxes, color reserved almost entirely for the four inventory states (наличие / резерв / аренда / ремонт) and for the single primary action on a screen. Precision over personality: the same control looks the same everywhere, so the operator's hands learn the tool and stop looking at it.

It explicitly rejects four things. The old 1С / accounting-CRM look (gray everything-bordered grids, system fonts, visual noise). The loud SaaS landing (gradients, oversized heroes, marketing or empty hero cards inside the working UI). The toy / bright register (heavy color, big radii, emoji in chrome, illustrations). And generic Material / Bootstrap defaults with no identity. Density here is a virtue, but density is not noise: grouping, sticky headers, inline meta, and status chips carry the load, never a wall of cards.

Information runs at 13px body on a tight, fixed rem scale; the type does the hierarchy through weight, not size theatrics. Motion is functional and fast (150–250ms, expo-out), present only to confirm state.

**Key Characteristics:**
- Workspace card (`#ffffff`) on a darker shell (`oklch(0.94 0 0)`) frames the work; the sidebar shares the shell tone.
- Hairline neutrals (`#e1ddd9` / `#cfcbc6`); chrome chroma ≤ 0.03.
- Color earns its place: inventory states, semantic feedback, one primary CTA. Never decoration.
- Flat at rest; depth only on floating surfaces and hover.
- One sans (Inter) for everything; JetBrains Mono for articuls and IDs only.

## 2. Colors

A near-monochrome warm-cool neutral ground with a disciplined OKLCH semantic layer; saturated hue appears only where it means something.

### Primary
- **Ink** (`#0c0a09`): the primary action surface and the densest text. Fills the default button (`bg-fg`), the active row, the selection checkmark. Near-black, faintly warm.
- **Ink-2** (`#292524`): secondary text and the default-button hover. One step up the ramp from Ink.

### Secondary
- **Signal Blue** (`oklch(0.55 0.13 250)`): the accent. Focus ring, current selection, link and info affordances. Calm, mid-chroma; never a fill on inactive states. Paired with **Signal Blue Soft** (`oklch(0.96 0.02 250)`) tint and **Signal Blue Ink** (`oklch(0.32 0.13 250)`) for text-on-tint.

### Tertiary
- **Inventory states**, the working palette of the catalog. **Available Green** (`oklch(0.55 0.13 150)`), **Reserve Yellow / Info** (`oklch(0.82 0.16 95)`), **Rented Amber / Warning** (`oklch(0.65 0.14 70)`), **Repair Red / Danger** (`oklch(0.58 0.20 28)`). Each has a `-soft` tint and a `-fg` ink for chips and group headers. These four colors are the only place the catalog gets loud, and that loudness is the data.
- **Kit Violet** (`oklch(0.55 0.18 295)`): virtual-kit badge, distinct from the four states.
- **Notion-pastel kind tones** (component sand `oklch(0.93 0.03 75)`, element lavender `oklch(0.93 0.05 290)`, consumable sky `oklch(0.93 0.05 230)`): low-chroma fills behind nomenclature-kind badges so dense lists stay uniform.

### Neutral
- **Workspace** (`#ffffff` card) / **Body** (`#fafafa`) / **Canvas** (`#f5f5f4`) / **Shell** (`oklch(0.94 0 0)`): four steps of ground, lightest where the work happens, darkest behind it.
- **Muted** (`#f5f5f4`) fills hovers, group headers, secondary chips. **Muted-fg** (`#78716c`) and **Subtle** (`#a8a29e`) carry meta text and placeholders.
- **Border** (`#e1ddd9`) / **Border-strong** (`#cfcbc6`): hairline dividers and input strokes.
- **Brand Navy** (`#1a1f3a`) / **Brand Red** (`#e63946`): the Будпрокат identity, used in brand chrome and the map pin, not in working data.

### Named Rules
**The Four-States Rule.** Saturated color in the catalog means inventory state, nothing else. Green = наличие, yellow = резерв, amber = аренда, red = ремонт. If a number is colored, that color is its status. Never tint a row for decoration.

**The One-Primary Rule.** Exactly one Ink-filled button per screen region. Everything else is secondary (card + border) or ghost. Two black buttons side by side is a bug.

## 3. Typography

**Body / UI Font:** Inter (fallbacks: Onest, ui-sans-serif, system-ui)
**Mono Font:** JetBrains Mono (fallbacks: ui-monospace, SFMono-Regular, Menlo)

**Character:** One humanist-grotesque sans does all the work: headings, labels, buttons, dense data. Cyrillic-first (the UI is Russian/Ukrainian), loaded with `latin,cyrillic,cyrillic-ext` subsets. `font-synthesis: none` and `kern/liga/calt` on; tabular-nums for every currency and count column. The mono face is a specialist, used only for articuls and IDs where character alignment matters.

### Hierarchy
- **Headline** (600, 17px, 1.2): page titles (e.g. «Каталог номенклатуры», «Новая аренда»). Fixed px, not fluid: the same size in a sidebar-narrowed viewport.
- **Title** (600, 15px, 1.3): section / drawer / dialog headers.
- **Body** (400, 13px, 1.45): the workspace default; prose stays ≤ 65–75ch, data tables run denser.
- **Label** (500, 11.5px, ~0.02em): field labels and group counts. Uppercase reserved for short eyebrows like «ВСЕ КАТЕГОРИИ», never sentences.
- **Mono** (400, 11px): articuls (`BP-XLSX-00353`), IDs, ИНН/ЕДРПОУ.

### Named Rules
**The Tabular Rule.** Every currency, quantity, and status count uses `tabular-nums`. Numbers that jiggle as they update read as amateur; in a tool full of counts, fixed metrics are non-negotiable.

**The Weight-Not-Size Rule.** Hierarchy comes from weight (400 → 500 → 600) inside a tight 11–17px band. Don't reach for a bigger size to signal importance in dense UI; reach for weight or a label color.

## 4. Elevation

Flat by default. Surfaces sit on tone and hairline borders, not shadows: the workspace card is lighter than the shell behind it, panels divide with `#e1ddd9` lines. Shadow is a response to state, never an ambient decoration on resting cards. The vocabulary climbs only as elements leave the plane: a faint `--shadow-xs` under the workspace card, a soft hairline-ring + diffuse stack under popovers and dropdowns, a deeper stack under dialogs.

### Shadow Vocabulary
- **Resting** (`--shadow-xs`: `0 1px 0 rgba(15,15,15,0.04)`): the workspace card and a few raised strips. Barely there.
- **Floating** (`--shadow-popover`: `0 0 0 1px rgba(15,15,15,0.04), 0 8px 24px -6px rgba(15,15,15,0.10), 0 4px 8px -2px rgba(15,15,15,0.05)`): popovers, dropdowns, selects. A 1px ring keeps the edge on light backgrounds; the diffuse drop gives lift without a frame.
- **Modal** (`--shadow-dialog`: deeper diffuse stack): dialogs only.

### Named Rules
**The Flat-By-Default Rule.** A resting card has no drop shadow. If you see a shadow, the element is floating (popover, dialog) or reacting (hover). A shadow on a static list card is the 2014-app tell: too dark, blur too small.

## 5. Components

Restrained and exact. Small radii, hairline borders, no halos. The same control reads the same on every screen.

### Buttons
- **Shape:** 8px radius (`rounded-md`); the compact `small`/`sm` size drops to 5px. Height 32px default, 26px small, 36px large.
- **Default (primary):** Ink fill (`bg-fg`) + `primary-fg` text + matching border; hover → Ink-2. One per region (see The One-Primary Rule).
- **Secondary:** card background + `border` stroke + Ink text; hover → muted fill. The workhorse.
- **Ghost:** transparent + Ink-2 text; hover → muted fill. For toolbar and icon actions.
- **Danger / Success / Accent:** semantic fill + white text; hover → `brightness-95`. State actions only.
- **Focus:** `ring-2 ring-fg ring-offset-1` (keyboard focus is unmistakable on the dense surface). `disabled` → `opacity-55`, pointer-events off.

### Chips (availability + kind)
- **Availability chip:** a colored status dot (`size-1.5` rounded-full) + tabular count + muted label («● 15 наличие»). Zero-value buckets drop so the row stays scannable. The dot color is the Four-States color.
- **Kind badge:** Notion-pastel fill (sand / lavender / sky) + matching ink, pill radius, 10.5px. Low chroma so a dense list reads uniform.
- **Selection chip / filter pill:** muted background, Ink text when active; ghost border when inactive.

### Cards / Containers
- **Corner Style:** 8px (`rounded-md`), 12px (`rounded-lg`) for the workspace card and the bottom drawer.
- **Background:** card `#ffffff` on the work surface; muted `#f5f5f4` for group-header strips.
- **Shadow Strategy:** flat at rest (see Elevation). Borders, not shadows, separate resting surfaces.
- **Border:** `#e1ddd9` hairline; `#cfcbc6` when the surface is interactive (input-like).
- **Internal Padding:** 10–16px; dense list rows run tighter (≈6px vertical).

### Inputs / Fields
- **Style:** card background, `border-strong` (`#cfcbc6`) 1px stroke, 8px radius, 32px height. Label above the field, never placeholder-as-label.
- **Focus:** the stroke densifies (`border-fg/30` → `border-fg/50`). No glow, no ring, no halo: a denser line is the entire focus signal on form controls (the focus ring is reserved for buttons and keyboard nav).
- **Error:** `aria-invalid` → danger stroke + danger-fg helper text below. **Disabled:** muted fill, subtle text.

### Segmented control (mutually-exclusive choice)
A radiogroup styled as one pill-bordered track with a light **card thumb** that slides (CSS transform, 150–200ms expo-out) under the active segment; inactive labels are muted-fg, the active label is Ink. Use it for a small, mutually-exclusive choice that lives **inline** in a row — delivery method (Самовывоз / Доставка), trip preset (Туда / Туда + обратно / Своё), discount kind — instead of a `<select>` or stacked radios. Roving tabindex + arrow-key nav; `focus-visible` ring on the segment. Primitive: `components/ui/segmented-control.tsx`. Don't use it for >4 options or for anything that isn't a single exclusive pick.

### Affixed number input (`[− + =] value [% ₴]`)
The price/discount editor: a single bordered field that carries its **operator segment** on the left (subtract / add / set) and its **unit affix** on the right (`%` or `₴`) inside the same stroke, so the whole adjustment reads as one control. `inputMode="decimal"`, `type="text"` (accepts comma), native spinners suppressed. Commit on blur / Apply, never per-keystroke. Reference: `PriceAdjustEditor` + the §5 «Цена за рейс» field. Prefer this over a bare number input wherever a value has a unit or an operator.

### Navigation
- **Sidebar:** shell-toned (`oklch(0.94 0 0)`), Ink text, muted hover, accent-marked active item. Collapses structurally on narrow viewports (not fluid type).
- **Breadcrumbs / tabs / command palette (⌘K):** standard patterns, label-sized type, muted-fg default → Ink on hover/active.

### Signature: Branch-Grouped List
The catalog's defining surface. A virtualized list of nomenclature rows that can group under **sticky branch headers** or **status headers** via a «Группировать» dropdown that mirrors the sort dropdown. Group header (`group-header`): muted strip, chevron + warehouse icon + branch name + city (muted uppercase) + count, square corners, sticks to the top of its run while scrolling. The same row card (drag handle, checkbox, thumbnail, availability chips, price/deposit) renders inside every group; a row duplicates under each warehouse that stocks it, each instance showing that warehouse's own counts. Sort runs inside each group.

## 6. Do's and Don'ts

### Do:
- **Do** drive every color from a semantic token (`bg-danger`, `text-success-fg`), never a Tailwind primitive (`bg-red-500`).
- **Do** keep one neutral family and one icon family (Lucide); one Inter face carries all UI text.
- **Do** keep chrome chroma ≤ 0.03; let saturated hue live only in inventory states, semantic feedback, and the single primary CTA.
- **Do** use `tabular-nums` on every count, price, and status number.
- **Do** label fields above the control, validate on blur, and make focus visible (ring on buttons/keyboard, denser stroke on inputs).
- **Do** carry depth with tone and hairline borders; add shadow only when an element floats or reacts.
- **Do** use the long em dash «—» (U+2014) for label / breadcrumb / title separators, surrounded by single spaces.
- **Do** virtualize and memoize dense / duplicating lists; keep frequently-toggled UI state local (never a synchronous route navigate).

### Don't:
- **Don't** evoke the old 1С / accounting CRM: gray everything-bordered grids, system fonts, visual noise.
- **Don't** import the loud SaaS landing into the tool: gradients, oversized heroes, marketing cards or empty hero cards.
- **Don't** go toy / bright: heavy color, big radii, emoji in chrome, illustrations.
- **Don't** ship generic Material / Bootstrap defaults with no identity.
- **Don't** use the middle dot «·» (U+00B7) as a text separator; it's a vibe-coded tell. Use «—».
- **Don't** put a drop shadow on a resting card, a halo/glow on an input, or two Ink-filled primary buttons in one region.
- **Don't** use `border-left`/`border-right` > 1px as a colored accent stripe; gradient text; or glassmorphism as decoration.
- **Don't** tint a row or number for decoration: in the catalog, color is always inventory state.
