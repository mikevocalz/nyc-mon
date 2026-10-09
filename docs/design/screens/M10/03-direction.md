# M10 Incubation choice: direction

Inputs: `01-research.md`, `02-references.md`, `docs/design/hlynk/DIRECTION.md`, `docs/DESIGN_SYSTEM.md`, `screens/M08/08-handoff.md`, `screens/M06/08-handoff.md`; canon #5, #7, #8; design D5, D8, D11, P2. Route `/(onboarding)/incubate?bloodline={F01|F02|F12}`. Shell: H-Lynk Core. Brief states: choose / confirmed; added: starting (write in flight), error, already-incubating.

## The one move

The chosen egg sits in the middle of the `IncubationRing`. The ring carries three stops, 15, 30 and 60, like stations on a loop line. Picking one lights its arc segment and prints "Ready at 4:45 PM" under the egg. On "Start incubating", the case closes over the egg: two square metal halves meet on the hinge, the rounded-square pad on the lid lights red, and the H-Lynk's scanner LED begins its slow breath. The egg went somewhere and the wait began, before anything else asks for attention.

## Layout (phone, inside the 3:4 screen)

```
 ┌ scanner head: LED off → incubating after confirm ┐
 │ status row: (consent pending)                     │
 │ How long should the egg incubate?                 │ type-title, h1, two lines
 │ The time you pick doesn't change your Mon.        │ type-body, text-muted
 │ Pick the wait that fits your day.                 │
 │            ╭──── 15 ────╮                          │
 │          60      ◯      │                          │ IncubationRing: three stops at
 │            ╰──── 30 ────╯                          │ 12, 4 and 8 o'clock; egg still in the centre
 │          Ready at 4:45 PM                         │ type-body-strong, tabular; empty until chosen
 │ [■■■■■ Start incubating ■■■■■■■■■■■■■■■■■■■■■]  │ cta, disabled until a stop is chosen
 └───────────────────────────────────────────────────┘
   [⌂] [≡]   ┏ trackpad ┓   [‹] [›]
```

Ring geometry: outer diameter = min(screen width − 64, 260 pt); stroke 12 pt; three equal arcs with 8 pt gaps; each stop's label sits outside its arc. The egg still is cropped to the egg (no block background) at 55% of the ring's inner diameter. Each stop is also a 48 pt radio target on its label, so nobody has to hit a thin arc.

## States

| State | Treatment |
|---|---|
| choose | no stop selected; all arcs `concrete-500` in both schemes (3.61:1 on daylit, 5.11:1 on night; `07-a11y.md`); CTA disabled with a hint; "Ready at" line empty (no placeholder time) |
| chosen-unconfirmed | selected arc in `signage-black` daylit / #F8F8F8 night with a 3 pt `royal` focus ring when focused; "Ready at {time}" from now + minutes, refreshed each minute |
| starting | CTA shows a spinner label for at most the save write (synchronous MMKV, so in practice one frame); trackpad disabled |
| confirmed | case closes over the egg; LED → `incubating` with its chip "Incubating, {n} minutes left"; then, only if notification permission is undecided, the M06 sheet (P2); otherwise straight to M11 |
| error | the save write threw. Nothing was created (the write is all-or-nothing). Message + "Try again" |
| already-incubating | a pending egg or a Mon exists: `router.replace` to M11 / M13. No second egg, ever |
| missing or bad `bloodline` param | `router.replace` to M08 (the choice is re-made; nothing was lost because nothing was written) |
| offline | same as choose; the egg is created locally and its `POST /v1/eggs` waits in the queue |

## The case

Drawn from `V11 ¶65`: compact square metal case, equal top and bottom halves, internal hinge, folding top handle only, no side latches, a rounded-square biometric pad on the lid that glows red. It must not read as a Poké Ball or an egg carton. No art exists; Phase 1 draws it as a flat vector in the kit (`EggCase`, missing primitive) until lookdev supplies a render. The pad's red sits on the case's dark metal, never on the H-Lynk's red body (D11 forbidden pair).

## Type and colour

`type-title`, `type-body`, `type-body-strong` (tabular for the time), `type-label` on ring stops. One orange face: the CTA (D5). The ring never uses orange or red: red is the LED's and the case pad's; orange is the CTA's.

## Motion

| Moment | Full | Reduced |
|---|---|---|
| Stop selected | arc fills along its length, 200 ms `standard` | arc fills instantly |
| Ready-at line appears | `motion-enter` | 200 ms fade |
| Case closes | bottom half rises behind the egg, lid swings down on the hinge, 700 ms `emphasized`; pad lights at the end | cross-fade from open egg to closed case, 200 ms; pad lit |
| LED starts | `motion-led-breath` | steady + progress tick row (DIRECTION.md) |
| To M06 / M11 | sheet rises after a 400 ms hold on the closed case | sheet rises after the cross-fade |

## No-list

- No speed-up, no paid skip, no "watch an ad" (brief, PERSONAS "pay-to-skip").
- No "recommended", "best" or "popular" on any stop.
- No countdown on this screen (M11 owns it).
- Never "capture case" in copy (Q4); "case" only.
- No claim that a length changes the Mon beyond what Phase 1 code does (Q27).
