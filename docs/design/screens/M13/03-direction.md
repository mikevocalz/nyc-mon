# M13 Home (Baby): direction

Inputs: `01-research.md`, `02-references.md`, `docs/design/hlynk/DIRECTION.md`, `docs/DESIGN_SYSTEM.md`, Decisions #4, #7, #8, #16. Route `/(home)`. Shell: H-Lynk Core. Scheme: the shell follows the New York time-of-day rig (D8).

## The one move

The Mon asks with its body, and the H-Lynk translates. When Fullness drops under the request line the Baby performs a food ask (look at the Caller, a species sound, a reach toward the bottom of the screen where the Feed key sits). The only text is the status chip in the H-Lynk's own voice: "Asking for food". The trackpad tap answers whatever the Mon is asking for. One thumb, one tap, and the Caller has answered the Mon.

## Layout (compact, portrait)

```
 ┌──────────────────────────────┐
 │ ███ scanner head ███████(◉)█ │ LED: needsYou blink or dark (see LED rule)
 │┌────────────────────────────┐│
 ││ Squeaklet        ◔  ◑  ◕   ││ name (type-label) · three CareMeterRings
 ││ Hood Ratti Bloodline  E F S││ ring captions: Energy, Fullness, Social
 ││                            ││
 ││        [ the Mon ]         ││ full-bleed 3D room, Mon on the ground disc
 ││                            ││
 ││ ● Asking for food          ││ status row: LED chip text, polite live region
 ││ [Feed] [Rest] [Play] [Dex] ││ care bar, 4 × 48 pt, labelled, inside the screen
 │└────────────────────────────┘│
 │ [⌂] [≡]  ┏━━━━━━━━┓  [‹] [›] │ trackpad: tap = answer the ask; drag = pan room
 └──────────────────────────────┘
```

"Play" is the visible label for the Social action (M16). The meter keeps the canon name Social (`V11 ¶51`, Q18 pending); the verb on the button is what the Caller does. The site already pairs the Social meter with the verb Play (`copy.ts` care rows).

## Breakpoints

| Class | Layout |
|---|---|
| Compact phone (SE 375×667, Pixel 8 412×915, Pro Max 440×956) | Standard shell: 3:4 screen, control row below. SE has 139 pt for the row and fits (`DIRECTION.md` table) |
| Compact short (landscape, slide-over) | `measureShell` returns `compact`: full-bleed screen, 24 pt head, 72 pt bar with pill trackpad. Rings move into the bar's leading edge; the care bar stays inside the screen bottom |
| Medium 600–839 | Shell capped at 440 pt wide, centred. A side card (`SheetSurface`, 320 pt) opens to the trailing side for M14–M16 instead of a bottom sheet |
| Expanded and Quest 2D window 1280×800 dp | `measureShell` gives `standard`: body 440 wide, screen 416×555, head 40, row capped at 200. 420 dp each side stays free: leading side shows the Mon's name card (link to M17), trailing side hosts M14–M16 panels. Pointer input from controller ray or hand pinch: every control has a hover state (`surface-sunken` wash) and a 48 dp minimum target; trackpad drag maps to ray drag |

## LED rule (decision)

The LED reports a request, nothing else.

| Care (advanced to now) | LED | Chip text |
|---|---|---|
| Any need below `needsAttentionBelow`, or a pending food request | `needsYou` | "Asking for food" / "Needs rest" / "Wants to play"; two or more: "Needs you: Fullness, Energy" |
| Content, awake | dark lens (`off`) | "Content" (status row only) |
| Asleep, no unmet need | dark lens (`off`) | "Asleep" |
| Asleep with an unmet need | `needsYou` | as above; Fullness can fall during sleep |
| Sluggish (overfed) | dark lens | "Full and slow" |

`DIRECTION.md` defines `off` as "no egg, no Mon". This screen widens it to "nothing to report". Kit owner updates the doc line; no code change (D3 holds: no colour-only meaning, the chip carries the text).

## Type and colour

Name `type-label` 600 on the screen's top scrim; bloodline `type-caption` `text-muted`. Ring captions `type-caption`. Status chip `type-label`. Rings: fill `structure` (royal-500 daylit, carolina night), track `concrete-200` daylit / `border` night. One fill colour for all three rings: the caption names the meter, so colour never carries identity. No red, no orange in the HUD: red belongs to the LED and trackpad ring (#7), orange to the CTA and the hatch. Danger colour is never used for a low meter.

## Motion

- Idle: the seeded vignette scheduler (`step()` in `@acme/core/sim`, `DEFAULT_VIGNETTE_SLOT_MS` 15 s) so the Mon is never a statue.
- Food ask: renderer intent `idle` + mood `needs-fullness` selects the ask vignette (`TODO(canon)` per species, Q31/Q44). Reduced: a static "looking at the Caller" pose, no loop.
- Ring change: fill tweens with `motion-enter` duration (300 ms); reduced: instant.
- LED: `motion-led-blink-needs-you`; reduced: steady with exclamation dot.
- Tap the Mon: one `attention` performance (needs the `attention` intent, P3). Reduced: the Mon turns its head to the camera; no bounce.
- Background-resumed: the Mon plays `approach` toward the camera once (presence `approachActive` for one clip). Reduced: static greeting pose.

## No-list

- No "while you were away" tally of hours hungry, no sad face, no tears, no "neglected".
- No numbers on the rings. Percentages exist only in the spoken value.
- No speech bubble from the Mon. No pronoun for the Mon.
- No push notification about care (STRIKE, `06-critique.md`).
- No currency, shop, streak chip, or level number (the concept sheet's "Lv. 12" is not canon, Q41/Q42).
- No danger red on meters.
